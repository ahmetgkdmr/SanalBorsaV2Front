import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { SIMULATION_EVENTS, LotEventMarker, TimeMachineCalc } from '../../core/models/time-machine.model';
import { formatInteger, formatLotRange } from '../../core/utils/format.util';

interface YearGrid {
  leftPct: number;
  year: number;
}

interface LotMarkerView {
  id: string;
  leftPct: number;
  /** Noktanın grafik içindeki dikey konumu (%), çizgi üzerinde */
  topPct: number;
  /** Üst üste binmesin diye yukarı kaydırma (px birimi CSS'te) */
  stack: number;
  marker: LotEventMarker;
  shortLabel: string;
  lotLabel: string;
}

interface ChartPoint {
  svgX: number;
  svgY: number;
  value: number;
  year: number;
  month: number;
  lots: number;
  lotEvent?: LotEventMarker;
}

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
/** SVG sadece çizgi için — metin HTML'de (preserveAspectRatio=none metni ezer) */
const CHART_W = 1000;
const CHART_H = 200;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 8;

@Component({
  selector: 'app-time-machine-simulation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sim show">
      <div class="sim-head">
        <div class="sim-year mono">{{ year() }}</div>
        <div class="sim-val mono" [innerHTML]="valueHtml()"></div>
      </div>
      <div class="sim-event">{{ event() }}</div>

      <div class="chart-block">
        <div class="chart-wrap">
          <svg
            #chartSvg
            viewBox="0 0 1000 200"
            preserveAspectRatio="none"
            (mousemove)="onChartMove($event)"
            (mouseleave)="clearHover()"
          >
            @for (g of grid(); track g.year) {
              <line
                [attr.x1]="(g.leftPct / 100) * 1000"
                [attr.y1]="plotTop"
                [attr.x2]="(g.leftPct / 100) * 1000"
                [attr.y2]="plotBottomY"
                stroke="var(--line)"
                stroke-width="1"
                opacity="0.4"
              />
            }

            @if (selectedMarker(); as sel) {
              <line
                [attr.x1]="(sel.leftPct / 100) * 1000"
                [attr.y1]="plotTop"
                [attr.x2]="(sel.leftPct / 100) * 1000"
                [attr.y2]="plotBottomY"
                stroke="rgba(240, 192, 64, 0.5)"
                stroke-width="1.5"
                stroke-dasharray="3 4"
              />
            }

            <path [attr.d]="areaPath()" fill="var(--up)" opacity="0.12" />
            <path
              [attr.d]="linePath()"
              fill="none"
              stroke="var(--up)"
              stroke-width="2.5"
              stroke-linejoin="round"
            />

            @if (hoverPoint(); as hp) {
              <line
                [attr.x1]="hp.svgX"
                [attr.y1]="plotTop"
                [attr.x2]="hp.svgX"
                [attr.y2]="plotBottomY"
                stroke="var(--accent)"
                stroke-width="1"
                stroke-dasharray="4 4"
                opacity="0.7"
              />
              <circle
                [attr.cx]="hp.svgX"
                [attr.cy]="hp.svgY"
                r="5"
                fill="var(--accent)"
                stroke="#1a1206"
                stroke-width="2"
              />
            } @else if (dotVisible()) {
              <circle
                [attr.cx]="dotX()"
                [attr.cy]="dotY()"
                r="4.5"
                fill="var(--accent)"
                stroke="#1a1206"
                stroke-width="2"
              />
            }
          </svg>

          @for (m of markerViews(); track m.id) {
            <button
              type="button"
              class="chart-dot"
              [class.bonus]="m.marker.actionType === 'BonusIssue'"
              [class.rights]="m.marker.actionType === 'RightsIssue'"
              [class.dividend]="m.marker.actionType === 'Dividend'"
              [class.active]="selectedId() === m.id"
              [style.left.%]="m.leftPct"
              [style.top.%]="m.topPct"
              [style.--stack]="m.stack"
              [title]="m.marker.actionDateLabel + ' · ' + m.shortLabel"
              (click)="selectMarker(m.id); $event.stopPropagation()"
            ></button>
          }

          @if (hoverTip(); as tip) {
            <div class="chart-tip" [style.left.%]="tip.leftPct" [style.top.%]="tip.topPct">
              <div class="tip-date">{{ tip.dateLabel }}</div>
              <div class="tip-val">{{ tip.valueLabel }}</div>
              @if (tip.lotsLabel) {
                <div class="tip-lots">{{ tip.lotsLabel }}</div>
              }
              @if (tip.eventLabel) {
                <div class="tip-event">{{ tip.eventLabel }}</div>
              }
            </div>
          }
        </div>

        <div class="chart-axis" aria-hidden="false">
          @for (g of grid(); track g.year) {
            <span class="axis-year mono" [style.left.%]="g.leftPct">{{ g.year }}</span>
          }
        </div>
      </div>

      @if (markerViews().length) {
        <div class="rail-legend">
          <span class="lg bonus">● Bedelsiz</span>
          <span class="lg rights">● Bedelli</span>
          <span class="lg dividend">● Temettü</span>
          <span class="lg hint">Noktaya tıkla → listede bul · log ölçek (2× / 4× farkı görünür)</span>
        </div>

        <div class="lot-events">
          <div class="lot-events-title">Şirket olayları ({{ markerViews().length }})</div>
          <div class="lot-events-body" #eventsList>
            @for (m of markerViews(); track m.id; let i = $index) {
              <div
                class="lot-event-item"
                [attr.data-event-index]="i"
                [class.bonus]="m.marker.actionType === 'BonusIssue'"
                [class.rights]="m.marker.actionType === 'RightsIssue'"
                [class.dividend]="m.marker.actionType === 'Dividend'"
                [class.selected]="selectedId() === m.id"
                (click)="selectMarker(m.id)"
              >
                <span class="lot-event-dot">{{ eventDot(m.marker.actionType) }}</span>
                <span class="lot-event-date">{{ m.marker.actionDateLabel }}</span>
                <span class="lot-event-label">{{ m.marker.story || m.marker.label }}</span>
                <span class="lot-event-lots mono">{{ m.lotLabel }}</span>
              </div>
            }
          </div>
        </div>
      }

      <div class="sim-note">Grafiğin üzerine gel — portföy değerini gör</div>
      <button class="btn replay" type="button" (click)="start()">Tekrar oynat</button>
    </div>
  `,
  styles: `
    .sim {
      margin-top: 22px;
      background: #0a0f1c;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      animation: tmIn 0.3s;
      &.show { display: block; }
    }

    .sim-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .sim-year { font-size: 30px; font-weight: 800; }
    .sim-val  { font-size: 19px; font-weight: 600; }

    .sim-event {
      min-height: 22px;
      font-size: 12.5px;
      color: #f0c040;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .chart-block { margin-bottom: 4px; }

    .chart-wrap {
      position: relative;
      height: 200px;
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
      cursor: crosshair;
    }

    .chart-dot {
      position: absolute;
      width: 9px;
      height: 9px;
      margin: 0;
      padding: 0;
      border-radius: 50%;
      border: 1.5px solid #0a0f1c;
      transform: translate(-50%, calc(-50% - var(--stack) * 11px));
      cursor: pointer;
      z-index: 3;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
      transition: transform 0.12s ease, box-shadow 0.12s ease;

      &:hover {
        transform: translate(-50%, calc(-50% - var(--stack) * 11px)) scale(1.35);
        z-index: 5;
      }

      &.active {
        box-shadow: 0 0 0 2px rgba(240, 192, 64, 0.85);
        z-index: 6;
      }

      &.bonus { background: #7dd3a0; }
      &.rights { background: #b388ff; }
      &.dividend { background: #f0c040; }
    }

    .chart-axis {
      position: relative;
      height: 20px;
      margin-top: 2px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .axis-year {
      position: absolute;
      top: 4px;
      transform: translateX(-50%);
      font-size: 10px;
      font-weight: 600;
      color: var(--muted);
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
    }

    .chart-tip {
      position: absolute;
      transform: translate(-50%, calc(-100% - 12px));
      pointer-events: none;
      background: #121a2e;
      border: 1px solid var(--accent);
      border-radius: 10px;
      padding: 8px 12px;
      min-width: 120px;
      max-width: 280px;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      z-index: 8;
    }

    .tip-date { font-size: 11px; color: var(--muted); font-weight: 600; }
    .tip-val  { font-size: 15px; font-weight: 800; color: var(--up); margin-top: 2px; }
    .tip-lots { font-size: 11px; color: var(--text); margin-top: 3px; }
    .tip-event {
      font-size: 10.5px;
      color: #f0c040;
      margin-top: 4px;
      font-weight: 700;
      line-height: 1.35;
      text-align: left;
    }

    .rail-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 14px;
      margin: 8px 0 6px;
      font-size: 10.5px;
      color: var(--muted);
    }

    .rail-legend .lg.bonus { color: #7dd3a0; }
    .rail-legend .lg.rights { color: #b388ff; }
    .rail-legend .lg.dividend { color: #f0c040; }
    .rail-legend .lg.hint { margin-left: auto; opacity: 0.75; }

    .lot-events {
      margin-top: 6px;
      border: 1px solid rgba(240, 192, 64, 0.25);
      border-radius: 10px;
      background: rgba(240, 192, 64, 0.05);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .lot-events-title {
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 800;
      color: #f0c040;
      padding: 10px 12px 8px;
      background: #10182a;
      border-bottom: 1px solid rgba(240, 192, 64, 0.18);
    }

    .lot-events-body {
      flex: 1 1 auto;
      max-height: 220px;
      overflow-y: auto;
      scroll-behavior: smooth;
      padding: 4px 8px 8px;
    }

    .lot-event-item {
      display: grid;
      grid-template-columns: 18px 1fr;
      grid-template-areas:
        'dot date'
        'dot label'
        'dot lots';
      gap: 1px 8px;
      padding: 8px 8px 8px 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 11px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s ease, box-shadow 0.15s ease;

      &:first-of-type { border-top: none; }
      &:hover { background: rgba(255, 255, 255, 0.03); }

      &.selected {
        background: rgba(240, 192, 64, 0.12);
        box-shadow: inset 0 0 0 1px rgba(240, 192, 64, 0.55);
      }
    }

    .lot-event-item.bonus { border-left: 3px solid #7dd3a0; }
    .lot-event-item.rights { border-left: 3px solid #b388ff; }
    .lot-event-item.dividend { border-left: 3px solid #f0c040; }

    .lot-event-item.bonus.selected {
      background: rgba(125, 211, 160, 0.14);
      box-shadow: inset 0 0 0 1px rgba(125, 211, 160, 0.55);
    }
    .lot-event-item.rights.selected {
      background: rgba(179, 136, 255, 0.14);
      box-shadow: inset 0 0 0 1px rgba(179, 136, 255, 0.55);
    }
    .lot-event-item.dividend.selected { background: rgba(240, 192, 64, 0.16); }

    .lot-event-dot { grid-area: dot; color: #f0c040; font-weight: 800; font-size: 13px; }
    .lot-event-date  { grid-area: date; color: var(--muted); font-weight: 600; }
    .lot-event-label {
      grid-area: label;
      color: var(--text);
      font-weight: 700;
      line-height: 1.45;
    }
    .lot-event-lots  { grid-area: lots; color: #f0c040; font-size: 10.5px; }

    .sim-note { font-size: 11px; color: var(--muted); margin-top: 8px; }

    .replay {
      margin-top: 10px;
      background: var(--panel2);
      border: 1px solid var(--line);
      color: var(--text);
      font-size: 12.5px;
      padding: 9px 16px;
    }

    @keyframes tmIn {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: none; }
    }
  `,
})
export class TimeMachineSimulationComponent implements OnDestroy {
  readonly calc = input.required<TimeMachineCalc>();
  readonly runTrigger = input(0);
  readonly chartSvg = viewChild<ElementRef<SVGSVGElement>>('chartSvg');
  readonly eventsList = viewChild<ElementRef<HTMLElement>>('eventsList');

  readonly plotTop = PLOT_TOP;
  readonly plotBottomY = CHART_H - PLOT_BOTTOM;

  readonly year = signal('—');
  readonly valueHtml = signal('');
  readonly event = signal('');
  readonly linePath = signal('');
  readonly areaPath = signal('');
  readonly dotX = signal(0);
  readonly dotY = signal(0);
  readonly dotVisible = signal(false);
  readonly grid = signal<YearGrid[]>([]);
  readonly markerViews = signal<LotMarkerView[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selectedMarker = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.markerViews().find((m) => m.id === id) ?? null;
  });
  readonly hoverPoint = signal<ChartPoint | null>(null);
  readonly hoverTip = signal<{
    leftPct: number;
    topPct: number;
    dateLabel: string;
    valueLabel: string;
    lotsLabel: string;
    eventLabel: string;
  } | null>(null);

  private chartPoints: ChartPoint[] = [];
  private animTimer?: ReturnType<typeof setTimeout>;
  private readonly reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(() => {
      if (this.runTrigger() > 0) this.start();
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }

  onChartMove(event: MouseEvent): void {
    if (!this.chartPoints.length) return;

    const svg = this.chartSvg()?.nativeElement;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * CHART_W;

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.chartPoints.length; i++) {
      const dist = Math.abs(this.chartPoints[i].svgX - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    const pt = this.chartPoints[bestIdx];
    const data = this.calc();
    const ev = pt.lotEvent;
    this.hoverPoint.set(pt);
    this.hoverTip.set({
      leftPct: (pt.svgX / CHART_W) * 100,
      topPct: (pt.svgY / CHART_H) * 100,
      dateLabel: `${monthLabel(pt.month)} ${pt.year}`,
      valueLabel: `${formatInteger(pt.value)} ₺`,
      lotsLabel:
        data.initialLots !== pt.lots
          ? `${formatLotRange(data.initialLots, pt.lots)} lot`
          : `${pt.lots.toLocaleString('tr-TR')} lot`,
      eventLabel: ev
        ? (ev.story ?? `${ev.label} · ${compactLotRange(ev.lotsBefore, ev.lotsAfter)} lot`)
        : '',
    });
  }

  clearHover(): void {
    this.hoverPoint.set(null);
    this.hoverTip.set(null);
  }

  eventDot(actionType: string): string {
    if (actionType === 'BonusIssue') return '◆';
    if (actionType === 'RightsIssue') return '◇';
    if (actionType === 'Dividend') return '●';
    return '•';
  }

  selectMarker(id: string): void {
    this.selectedId.set(id);
    const list = this.eventsList()?.nativeElement;
    const idx = this.markerViews().findIndex((m) => m.id === id);
    if (!list || idx < 0) return;

    requestAnimationFrame(() => {
      const el = list.querySelector(`[data-event-index="${idx}"]`) as HTMLElement | null;
      if (!el) return;
      const listRect = list.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - listRect.top - listRect.height / 2 + elRect.height / 2;
      list.scrollBy({ top: offset, behavior: 'smooth' });
    });

    const m = this.markerViews()[idx];
    if (m) {
      this.event.set(
        m.marker.story ??
          `${m.marker.label} (${m.marker.actionDateLabel}) · ${m.lotLabel} lot`,
      );
    }
  }

  start(): void {
    this.stop();
    this.clearHover();
    this.selectedId.set(null);

    const data = this.calc();
    if (!data.valueSeries.length) return;

    const layout = buildChartLayout(data);
    this.chartPoints = layout.points;
    this.markerViews.set(layout.markers);
    this.grid.set(layout.yearGrids);

    const { series, valueSeries, initialLots, lots } = data;
    const { xAt, yAt } = layout;
    const floorY = CHART_H - PLOT_BOTTOM;

    let i = 0;
    let d = '';
    let lastEventYear: number | null = null;

    const speedFor = (p: (typeof series)[0]) => {
      if (this.reducedMotion) return 0;
      if (SIMULATION_EVENTS[p.year]) return 110;
      return 28;
    };

    const lotsLabel = (count: number) =>
      initialLots !== count
        ? `${formatLotRange(initialLots, count)} lot`
        : `${count.toLocaleString('tr-TR')} lot`;

    const step = () => {
      if (i >= series.length) {
        this.dotVisible.set(true);
        this.event.set('🏁 Bugüne ulaştın!');
        return;
      }

      const p = series[i];
      const x = xAt(i);
      const y = yAt(valueSeries[i]);
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;

      this.linePath.set(d);
      this.areaPath.set(`${d} L ${x} ${floorY} L 10 ${floorY} Z`);
      this.dotX.set(x);
      this.dotY.set(y);
      this.dotVisible.set(true);
      this.year.set(String(p.year));

      const curLots = this.chartPoints[i]?.lots ?? lots;
      this.valueHtml.set(
        `<span style="color:var(--up)">${formatInteger(valueSeries[i])} ₺</span> ` +
          `<span style="color:var(--muted);font-size:12px">(${lotsLabel(curLots)})</span>`,
      );

      const curPoint = this.chartPoints[i];

      if (SIMULATION_EVENTS[p.year] && lastEventYear !== p.year) {
        this.event.set(SIMULATION_EVENTS[p.year]);
        lastEventYear = p.year;
      } else if (curPoint?.lotEvent) {
        const ev = curPoint.lotEvent;
        this.event.set(
          ev.story ??
            `${ev.label} (${ev.actionDateLabel}) · ${compactLotRange(ev.lotsBefore, ev.lotsAfter)} lot`,
        );
      } else if (!SIMULATION_EVENTS[p.year]) {
        this.event.set('');
      }

      i++;
      const delay = speedFor(p);

      if (delay === 0) {
        while (i < series.length) {
          d += ` L ${xAt(i)} ${yAt(valueSeries[i])}`;
          i++;
        }
        this.linePath.set(d);
        this.areaPath.set(
          `${d} L ${xAt(series.length - 1)} ${floorY} L 10 ${floorY} Z`,
        );
        this.event.set('🏁 Bugüne ulaştın!');
        return;
      }

      this.animTimer = setTimeout(() => requestAnimationFrame(step), delay);
    };

    this.linePath.set('');
    this.areaPath.set('');
    this.dotVisible.set(false);
    step();
  }

  private stop(): void {
    if (this.animTimer) clearTimeout(this.animTimer);
    this.animTimer = undefined;
  }
}

/** Backend ayı 1–12 gönderir */
function monthLabel(month: number): string {
  if (month >= 1 && month <= 12) return MONTHS_TR[month - 1];
  if (month >= 0 && month <= 11) return MONTHS_TR[month];
  return '';
}

function buildChartLayout(data: TimeMachineCalc) {
  const { series, valueSeries, initialLots, lots } = data;
  const lotSeries = normalizeLotSeries(data);
  const lotEvents = resolveLotEvents(series, lotSeries, data);

  const positives = valueSeries.filter((v) => v > 0);
  const min = positives.length ? Math.min(...positives) : Math.min(...valueSeries);
  const max = Math.max(...valueSeries);
  // Log ölçek: aynı oran = aynı dikey mesafe (2× ile 4× farkı net)
  const useLog = max > 0 && min > 0 && max / Math.max(min, 1e-9) >= 4;

  const logMin = Math.log10(Math.max(min, 1e-6));
  const logMax = Math.log10(Math.max(max, 1e-6));
  const logRange = logMax - logMin || 1;
  const linRange = max - min || 1;
  const plotH = CHART_H - PLOT_TOP - PLOT_BOTTOM;

  const xAt = (i: number) =>
    series.length <= 1 ? CHART_W / 2 : (i / (series.length - 1)) * (CHART_W - 20) + 10;

  const yAt = (v: number) => {
    const t = useLog
      ? (Math.log10(Math.max(v, 1e-6)) - logMin) / logRange
      : (v - min) / linRange;
    return CHART_H - PLOT_BOTTOM - Math.min(1, Math.max(0, t)) * plotH;
  };

  const eventsByIndex = new Map<number, LotEventMarker>();
  for (const ev of lotEvents) {
    const idx = series.findIndex((p) => p.year === ev.year && p.month === ev.month);
    if (idx >= 0) eventsByIndex.set(idx, ev);
  }

  const points: ChartPoint[] = series.map((p, i) => ({
    svgX: xAt(i),
    svgY: yAt(valueSeries[i]),
    value: valueSeries[i],
    year: p.year,
    month: p.month,
    lots: lotSeries[i] ?? lots,
    lotEvent: eventsByIndex.get(i),
  }));

  const rawMarkers: LotMarkerView[] = lotEvents
    .map((marker, i) => {
      const idx = series.findIndex((p) => p.year === marker.year && p.month === marker.month);
      if (idx < 0) return null;
      const svgY = yAt(valueSeries[idx]);
      return {
        id: `${marker.actionDateLabel}|${marker.actionType}|${marker.label}|${i}`,
        leftPct: (xAt(idx) / CHART_W) * 100,
        topPct: (svgY / CHART_H) * 100,
        stack: 0,
        marker,
        shortLabel: shortEventLabel(marker),
        lotLabel: compactLotRange(marker.lotsBefore, marker.lotsAfter),
      };
    })
    .filter((m): m is LotMarkerView => m !== null)
    .sort((a, b) => a.leftPct - b.leftPct || a.topPct - b.topPct);

  assignDotStacks(rawMarkers);

  // Yıl etiketleri: her yılın ilk noktası (HTML eksende — SVG metni ezilmez)
  const yearCandidates: YearGrid[] = [];
  const seenYears = new Set<number>();
  series.forEach((p, i) => {
    if (seenYears.has(p.year)) return;
    seenYears.add(p.year);
    yearCandidates.push({ leftPct: (xAt(i) / CHART_W) * 100, year: p.year });
  });
  const yearStep = yearCandidates.length > 20 ? 2 : 1;
  const yearGrids = yearCandidates.filter(
    (g, i) => i === 0 || i === yearCandidates.length - 1 || i % yearStep === 0,
  );

  return { points, markers: rawMarkers, yearGrids, xAt, yAt, useLog };
}

/** Yakın noktaları dikey kaydır — üst üste binmesin */
function assignDotStacks(markers: LotMarkerView[]): void {
  const placed: { left: number; stack: number }[] = [];
  for (const m of markers) {
    let stack = 0;
    while (placed.some((p) => Math.abs(p.left - m.leftPct) < 1.6 && p.stack === stack)) {
      stack++;
      if (stack > 4) break;
    }
    m.stack = stack;
    placed.push({ left: m.leftPct, stack });
  }
}

function normalizeLotSeries(data: TimeMachineCalc): number[] {
  const { series, lotSeries, initialLots, lots, lotEvents } = data;

  if (lotSeries.length === series.length && hasLotChanges(lotSeries)) {
    return lotSeries;
  }

  if (lotEvents.length) {
    let current = initialLots;
    const eventAt = new Map<number, LotEventMarker>();
    for (const ev of lotEvents) {
      const idx = series.findIndex((p) => p.year === ev.year && p.month === ev.month);
      if (idx >= 0) eventAt.set(idx, ev);
    }

    return series.map((_, i) => {
      const ev = eventAt.get(i);
      if (ev) current = ev.lotsAfter;
      return current;
    });
  }

  if (lotSeries.length === series.length) return lotSeries;

  return series.map((_, i) => (i === series.length - 1 ? lots : initialLots));
}

function hasLotChanges(lotSeries: number[]): boolean {
  for (let i = 1; i < lotSeries.length; i++) {
    if (lotSeries[i] !== lotSeries[i - 1]) return true;
  }
  return false;
}

function resolveLotEvents(
  series: TimeMachineCalc['series'],
  lotSeries: number[],
  data: TimeMachineCalc,
): LotEventMarker[] {
  if (data.lotEvents?.length) return data.lotEvents;
  return inferLotEventsFromSeries(series, lotSeries, data.mode, data.initialLots, data.lots);
}

function inferLotEventsFromSeries(
  series: TimeMachineCalc['series'],
  lotSeries: number[],
  mode: TimeMachineCalc['mode'],
  initialLots: number,
  finalLots: number,
): LotEventMarker[] {
  const events: LotEventMarker[] = [];

  for (let i = 1; i < lotSeries.length; i++) {
    const before = lotSeries[i - 1];
    const after = lotSeries[i];
    if (after <= before) continue;

    const ratio = before > 0 ? after / before : Infinity;
    if (mode === 'dca' && ratio < 1.5) continue;
    if (mode === 'lump' && ratio < 1.01) continue;

    const p = series[i];
    if (!p) continue;

    events.push({
      year: p.year,
      month: p.month,
      actionDateLabel: `${monthLabel(p.month)} ${p.year}`,
      actionType: 'Inferred',
      label: ratio >= 1.9 ? `Hisse bölünmesi ×${ratio.toFixed(0)}` : 'Lot artışı',
      lotsBefore: before,
      lotsAfter: after,
    });
  }

  if (!events.length && initialLots > 0 && finalLots > initialLots && series.length > 1) {
    const last = series[series.length - 1];
    events.push({
      year: last.year,
      month: last.month,
      actionDateLabel: `${monthLabel(last.month)} ${last.year}`,
      actionType: 'Inferred',
      label: 'Lot artışı',
      lotsBefore: initialLots,
      lotsAfter: finalLots,
    });
  }

  return events;
}

function shortEventLabel(marker: LotEventMarker): string {
  if (marker.actionType === 'Dividend') return 'Temettü';
  if (marker.actionType === 'BonusIssue') return 'Bedelsiz';
  if (marker.actionType === 'RightsIssue') return 'Bedelli';
  const label = marker.label;
  if (label.length <= 18) return label;
  if (label.includes('bölünmesi')) return label.replace('Hisse bölünmesi', 'Bölünme');
  if (label.includes('Bedelsiz')) return 'Bedelsiz';
  if (label.includes('Bedelli')) return 'Bedelli';
  return label.slice(0, 16) + '…';
}

function compactLotRange(before: number, after: number): string {
  return `${compactNum(before)}→${compactNum(after)}`;
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  if (n >= 10) return n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}
