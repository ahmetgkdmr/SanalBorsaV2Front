import {
  ChangeDetectionStrategy,
  Component,
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
  x: number;
  year: number;
}

interface LotMarkerView {
  leftPct: number;
  topPct: number;
  lane: number;
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
const CHART_W = 1000;
const CHART_H = 240;

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

      <div class="chart-wrap">
        <svg
          #chartSvg
          viewBox="0 0 1000 240"
          preserveAspectRatio="none"
          (mousemove)="onChartMove($event)"
          (mouseleave)="clearHover()"
        >
          @for (g of grid(); track g.year) {
            <line
              [attr.x1]="g.x"
              y1="10"
              [attr.x2]="g.x"
              y2="222"
              stroke="var(--line)"
              stroke-width="1"
              opacity="0.5"
            />
            <text
              [attr.x]="g.x + 4"
              y="236"
              fill="var(--muted)"
              font-size="11"
              font-family="IBM Plex Mono, monospace"
            >
              {{ g.year }}
            </text>
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
              y1="10"
              [attr.x2]="hp.svgX"
              y2="222"
              stroke="var(--accent)"
              stroke-width="1"
              stroke-dasharray="4 4"
              opacity="0.7"
            />
            <circle
              [attr.cx]="hp.svgX"
              [attr.cy]="hp.svgY"
              r="6"
              fill="var(--accent)"
              stroke="#1a1206"
              stroke-width="2"
            />
          } @else if (dotVisible()) {
            <circle
              [attr.cx]="dotX()"
              [attr.cy]="dotY()"
              r="5"
              fill="var(--accent)"
              stroke="#1a1206"
              stroke-width="2"
            />
          }
        </svg>

        @for (m of markerViews(); track m.marker.actionDateLabel + m.marker.label + m.lane) {
          <div
            class="lot-marker"
            [style.left.%]="m.leftPct"
            [style.--lane]="m.lane"
          >
            <div class="lot-marker-line"></div>
            <div class="lot-marker-badge">
              <span class="lot-marker-title">{{ m.shortLabel }}</span>
              <span class="lot-marker-sub">{{ m.lotLabel }}</span>
            </div>
            <div class="lot-marker-dot"></div>
          </div>
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

      @if (markerViews().length) {
        <div class="lot-events">
          <div class="lot-events-title">Lot artışları ({{ markerViews().length }})</div>
          @for (m of markerViews(); track m.marker.actionDateLabel + m.marker.label) {
            <div class="lot-event-item">
              <span class="lot-event-dot">↑</span>
              <span class="lot-event-date">{{ m.marker.actionDateLabel }}</span>
              <span class="lot-event-label">{{ m.marker.label }}</span>
              <span class="lot-event-lots mono">{{ m.lotLabel }} lot</span>
            </div>
          }
        </div>
      }

      <div class="sim-note">Grafiğin üzerine gel — portföy değerini gör · altın çizgiler lot artışını gösterir</div>
      <button class="btn replay" type="button" (click)="start()">↺ Tekrar oynat</button>
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

    .chart-wrap {
      position: relative;
      height: 240px;
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
      cursor: crosshair;
    }

    .lot-marker {
      position: absolute;
      top: 0;
      bottom: 18px;
      width: 0;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 3;
    }

    .lot-marker-line {
      position: absolute;
      top: calc(28px + var(--lane) * 34px);
      bottom: 0;
      left: -1px;
      width: 2px;
      background: linear-gradient(
        180deg,
        rgba(240, 192, 64, 0.95) 0%,
        rgba(240, 192, 64, 0.35) 100%
      );
      box-shadow: 0 0 8px rgba(240, 192, 64, 0.45);
    }

    .lot-marker-badge {
      position: absolute;
      top: calc(2px + var(--lane) * 34px);
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      max-width: 110px;
      padding: 4px 7px;
      border-radius: 8px;
      background: rgba(20, 16, 6, 0.92);
      border: 1px solid rgba(240, 192, 64, 0.85);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
      text-align: center;
      white-space: nowrap;
    }

    .lot-marker-title {
      font-size: 9.5px;
      font-weight: 800;
      color: #f0c040;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100px;
    }

    .lot-marker-sub {
      font-size: 8.5px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.75);
      font-family: 'IBM Plex Mono', monospace;
    }

    .lot-marker-dot {
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translate(-50%, 50%);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #f0c040;
      border: 2px solid #1a1206;
      box-shadow: 0 0 6px rgba(240, 192, 64, 0.7);
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
      text-align: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      z-index: 4;
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
    }

    .lot-events {
      margin-top: 10px;
      padding: 10px 12px;
      background: rgba(240, 192, 64, 0.05);
      border: 1px solid rgba(240, 192, 64, 0.25);
      border-radius: 10px;
    }

    .lot-events-title {
      font-size: 11px;
      font-weight: 800;
      color: #f0c040;
      margin-bottom: 6px;
    }

    .lot-event-item {
      display: grid;
      grid-template-columns: 18px 1fr;
      grid-template-areas:
        'dot date'
        'dot label'
        'dot lots';
      gap: 1px 8px;
      padding: 6px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 11px;

      &:first-of-type { border-top: none; padding-top: 0; }
    }

    .lot-event-dot { grid-area: dot; color: #f0c040; font-weight: 800; font-size: 13px; }
    .lot-event-date  { grid-area: date; color: var(--muted); font-weight: 600; }
    .lot-event-label { grid-area: label; color: var(--text); font-weight: 700; }
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
      dateLabel: `${MONTHS_TR[pt.month] ?? ''} ${pt.year}`,
      valueLabel: `${formatInteger(pt.value)} ₺`,
      lotsLabel:
        data.initialLots !== pt.lots
          ? `${formatLotRange(data.initialLots, pt.lots)} lot`
          : `${pt.lots.toLocaleString('tr-TR')} lot`,
      eventLabel: ev ? `${ev.label} · ${compactLotRange(ev.lotsBefore, ev.lotsAfter)} lot` : '',
    });
  }

  clearHover(): void {
    this.hoverPoint.set(null);
    this.hoverTip.set(null);
  }

  start(): void {
    this.stop();
    this.clearHover();

    const data = this.calc();
    if (!data.valueSeries.length) return;

    const layout = buildChartLayout(data);
    this.chartPoints = layout.points;
    this.markerViews.set(layout.markers);
    this.grid.set(layout.yearGrids);

    const { series, valueSeries, initialLots, lots } = data;
    const { xAt, yAt } = layout;

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
      this.areaPath.set(`${d} L ${x} ${CHART_H - 18} L 10 ${CHART_H - 18} Z`);
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
          `📈 ${ev.label} (${ev.actionDateLabel}) · ${compactLotRange(ev.lotsBefore, ev.lotsAfter)} lot`,
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
        this.areaPath.set(`${d} L ${xAt(series.length - 1)} ${CHART_H - 18} L 10 ${CHART_H - 18} Z`);
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

function buildChartLayout(data: TimeMachineCalc) {
  const { series, valueSeries, initialLots, lots, mode } = data;
  const lotSeries = normalizeLotSeries(data);
  const lotEvents = resolveLotEvents(series, lotSeries, data);

  const min = Math.min(...valueSeries);
  const max = Math.max(...valueSeries);
  const range = max - min || 1;

  const xAt = (i: number) => (i / (series.length - 1)) * (CHART_W - 20) + 10;
  const yAt = (v: number) => CHART_H - 18 - ((v - min) / range) * (CHART_H - 46);

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
    .map((marker) => {
      const idx = series.findIndex((p) => p.year === marker.year && p.month === marker.month);
      if (idx < 0) return null;
      return {
        leftPct: (xAt(idx) / CHART_W) * 100,
        topPct: (yAt(valueSeries[idx]) / CHART_H) * 100,
        lane: 0,
        marker,
        shortLabel: shortEventLabel(marker),
        lotLabel: compactLotRange(marker.lotsBefore, marker.lotsAfter),
      };
    })
    .filter((m): m is LotMarkerView => m !== null)
    .sort((a, b) => a.leftPct - b.leftPct);

  assignMarkerLanes(rawMarkers);

  const yearGrids: YearGrid[] = [];
  series.forEach((p, i) => {
    if (p.month === 0) yearGrids.push({ x: xAt(i), year: p.year });
  });

  return { points, markers: rawMarkers, yearGrids, xAt, yAt };
}

function assignMarkerLanes(markers: LotMarkerView[]): void {
  const lanes: number[] = [];
  for (const m of markers) {
    let lane = 0;
    while (lanes[lane] !== undefined && m.leftPct - lanes[lane] < 9) lane++;
    lanes[lane] = m.leftPct;
    m.lane = lane;
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
      actionDateLabel: `${MONTHS_TR[p.month] ?? ''} ${p.year}`,
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
      actionDateLabel: `${MONTHS_TR[last.month] ?? ''} ${last.year}`,
      actionType: 'Inferred',
      label: 'Lot artışı',
      lotsBefore: initialLots,
      lotsAfter: finalLots,
    });
  }

  return events;
}

function shortEventLabel(marker: LotEventMarker): string {
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
  const v = Math.round(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return v.toLocaleString('tr-TR');
}
