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

interface HeadChip {
  leftPct: number;
  topPct: number;
  /** Sağ uçta etiketi sola, sol uçta sağa çevir — panel dışına taşmasın */
  flip: boolean;
  pinLeft: boolean;
  /** Çizgi tepedeyse etiketi altına al — başlığın üstüne taşmasın */
  below: boolean;
  dateLabel: string;
  priceLabel: string;
  valueLabel: string;
}

/** Grafiğin tek bir adımı — günlük seri varsa bir işlem günü, yoksa bir ay */
interface Frame {
  time: number;
  year: number;
  month: number;
  day: number;
  price: number;
  value: number;
  lots: number;
}

interface ChartPoint {
  svgX: number;
  svgY: number;
  value: number;
  price: number;
  year: number;
  month: number;
  dateLabel: string;
  lots: number;
  lotEvent?: LotEventMarker;
}

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
/** SVG sadece çizgi için — metin HTML'de (preserveAspectRatio=none metni ezer) */
const CHART_W = 1000;
const CHART_H = 200;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 8;
/** Şerit soldan sağa açılırken toplam süre (ms) — nokta sayısından bağımsız akıcı */
const REPLAY_MIN_MS = 4500;
const REPLAY_MAX_MS = 10_000;
const REPLAY_MS_PER_POINT = 2.6;
/** Okunabilirlik için etiket saniyede ~16 kez tazelenir (çizgi yine 60fps akar) */
const LABEL_THROTTLE_MS = 60;
/** Şirket olayı yazısı en az bu kadar ekranda kalsın */
const EVENT_HOLD_MS = 1100;
/** Bu yoğunluğun üstünde eğri yumuşatmaya gerek yok — noktalar zaten piksel altı */
const SMOOTHING_MAX_POINTS = 400;
/** İki yıl etiketi arasındaki en küçük yatay boşluk (%) */
const MIN_YEAR_GAP_PCT = 4.5;

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
            <defs>
              <clipPath [attr.id]="clipId">
                <rect x="0" y="0" [attr.width]="revealW()" height="200" />
              </clipPath>
            </defs>

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
                stroke="var(--accent)"
                stroke-width="1.5"
                stroke-dasharray="3 4"
                opacity="0.55"
              />
            }

            <g [attr.clip-path]="clipUrl">
              <path [attr.d]="areaPath()" fill="var(--up)" opacity="0.14" />
              <path
                [attr.d]="linePath()"
                fill="none"
                stroke="var(--up)"
                stroke-width="2.5"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
            </g>

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
                stroke="var(--sim-bg)"
                stroke-width="2"
              />
            } @else if (dotVisible()) {
              @if (animating()) {
                <circle
                  [attr.cx]="dotX()"
                  [attr.cy]="dotY()"
                  r="9"
                  fill="var(--accent)"
                  opacity="0.22"
                />
              }
              <circle
                [attr.cx]="dotX()"
                [attr.cy]="dotY()"
                r="4.5"
                fill="var(--accent)"
                stroke="var(--sim-bg)"
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
              [class.pending]="animating() && m.leftPct * 10 > revealW()"
              [style.left.%]="m.leftPct"
              [style.top.%]="m.topPct"
              [style.--stack]="m.stack"
              [title]="m.marker.actionDateLabel + ' · ' + m.shortLabel"
              (click)="selectMarker(m.id); $event.stopPropagation()"
            ></button>
          }

          @if (headChip(); as chip) {
            <div
              class="head-chip mono"
              [class.flip]="chip.flip"
              [class.pin-left]="chip.pinLeft"
              [class.below]="chip.below"
              [style.left.%]="chip.leftPct"
              [style.top.%]="chip.topPct"
            >
              <span class="chip-date">{{ chip.dateLabel }}</span>
              <span class="chip-price">{{ chip.priceLabel }}</span>
              <span class="chip-val">{{ chip.valueLabel }}</span>
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
      --sim-bg: #0a0f1c;
      --sim-surface: #121a2e;
      --sim-hair: rgba(255, 255, 255, 0.08);
      --sim-hover: rgba(255, 255, 255, 0.04);

      margin-top: 22px;
      background: var(--sim-bg);
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      animation: tmIn 0.3s;
      &.show { display: block; }
    }

    :host-context([data-theme='light']) .sim {
      --sim-bg: #f7f9fd;
      --sim-surface: #ffffff;
      --sim-hair: rgba(21, 32, 51, 0.1);
      --sim-hover: rgba(21, 32, 51, 0.04);
      box-shadow: inset 0 0 0 1px rgba(21, 32, 51, 0.03);
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
      color: var(--accent);
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
      border: 1.5px solid var(--sim-bg);
      transform: translate(-50%, calc(-50% - var(--stack) * 11px));
      cursor: pointer;
      z-index: 3;
      box-shadow: 0 0 0 1px var(--sim-hair);
      transition: transform 0.12s ease, box-shadow 0.12s ease;

      &:hover {
        transform: translate(-50%, calc(-50% - var(--stack) * 11px)) scale(1.35);
        z-index: 5;
      }

      &.active {
        box-shadow: 0 0 0 2px var(--accent);
        z-index: 6;
      }

      &.bonus { background: var(--up); }
      &.rights { background: var(--prem); }
      &.dividend { background: var(--accent); }

      &.pending {
        opacity: 0;
        transform: translate(-50%, calc(-50% - var(--stack) * 11px)) scale(0.3);
      }
    }

    .head-chip {
      position: absolute;
      z-index: 7;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
      --chip-x: -50%;
      --chip-y: calc(-100% - 14px);
      transform: translate(var(--chip-x), var(--chip-y));
      padding: 5px 9px;
      border-radius: 9px;
      background: var(--sim-surface);
      border: 1px solid color-mix(in srgb, var(--up) 45%, transparent);
      box-shadow: var(--shadow);
      pointer-events: none;
      white-space: nowrap;
      will-change: left, top;

      &.flip { --chip-x: -100%; }
      &.pin-left { --chip-x: 0%; }
      &.below { --chip-y: 14px; }
    }

    .chip-date { font-size: 10px; font-weight: 700; color: var(--muted); letter-spacing: 0.2px; }
    .chip-price { font-size: 10.5px; font-weight: 600; color: var(--text); opacity: 0.85; }
    .chip-val { font-size: 13px; font-weight: 800; color: var(--up); }

    .chart-axis {
      position: relative;
      height: 20px;
      margin-top: 2px;
      border-top: 1px solid var(--sim-hair);
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
      background: var(--sim-surface);
      border: 1px solid var(--accent);
      border-radius: 10px;
      padding: 8px 12px;
      min-width: 120px;
      max-width: 280px;
      text-align: center;
      box-shadow: var(--shadow);
      z-index: 8;
    }

    .tip-date { font-size: 11px; color: var(--muted); font-weight: 600; }
    .tip-val  { font-size: 15px; font-weight: 800; color: var(--up); margin-top: 2px; }
    .tip-lots { font-size: 11px; color: var(--text); margin-top: 3px; }
    .tip-event {
      font-size: 10.5px;
      color: var(--accent);
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

    .rail-legend .lg.bonus { color: var(--up); }
    .rail-legend .lg.rights { color: var(--prem); }
    .rail-legend .lg.dividend { color: var(--accent); }
    .rail-legend .lg.hint { margin-left: auto; opacity: 0.75; }

    .lot-events {
      margin-top: 6px;
      border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
      border-radius: 10px;
      background: color-mix(in srgb, var(--accent) 6%, transparent);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .lot-events-title {
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 800;
      color: var(--accent);
      padding: 10px 12px 8px;
      background: var(--sim-surface);
      border-bottom: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
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
      border-top: 1px solid var(--sim-hair);
      font-size: 11px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s ease, box-shadow 0.15s ease;

      &:first-of-type { border-top: none; }
      &:hover { background: var(--sim-hover); }

      &.selected {
        background: color-mix(in srgb, var(--accent) 14%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
      }
    }

    .lot-event-item.bonus { border-left: 3px solid var(--up); }
    .lot-event-item.rights { border-left: 3px solid var(--prem); }
    .lot-event-item.dividend { border-left: 3px solid var(--accent); }

    .lot-event-item.bonus.selected {
      background: color-mix(in srgb, var(--up) 15%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--up) 55%, transparent);
    }
    .lot-event-item.rights.selected {
      background: color-mix(in srgb, var(--prem) 15%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--prem) 55%, transparent);
    }
    .lot-event-item.dividend.selected {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
    }

    .lot-event-dot { grid-area: dot; color: var(--accent); font-weight: 800; font-size: 13px; }
    .lot-event-date  { grid-area: date; color: var(--muted); font-weight: 600; }
    .lot-event-label {
      grid-area: label;
      color: var(--text);
      font-weight: 700;
      line-height: 1.45;
    }
    .lot-event-lots  { grid-area: lots; color: var(--accent); font-size: 10.5px; }

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
  readonly clipId = `tm-clip-${Math.random().toString(36).slice(2, 9)}`;
  readonly clipUrl = `url(#${this.clipId})`;

  /** Çizginin soldan sağa açıldığı maske genişliği (SVG birimi) */
  readonly revealW = signal(0);
  readonly animating = signal(false);
  readonly headChip = signal<HeadChip | null>(null);

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
  private rafId?: number;
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
    if (!this.chartPoints.length || this.animating()) return;

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
      dateLabel: `${pt.dateLabel} · ${formatPrice(pt.price)} ₺`,
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

    const { initialLots, lots } = data;
    const { xAt, curve, frames } = layout;
    const n = frames.length;
    const lastX = xAt(n - 1);

    // Eğri bir kez çizilir; animasyon sadece maskeyi soldan sağa açar (jank yok).
    this.linePath.set(curve.linePath);
    this.areaPath.set(curve.areaPath);

    const lotsLabel = (count: number) =>
      initialLots !== count
        ? `${formatLotRange(initialLots, count)} lot`
        : `${count.toLocaleString('tr-TR')} lot`;

    /** Baş noktasını her karede taşı; yazılar okunabilsin diye daha seyrek tazelenir */
    const moveHead = (f: number) => {
      const x = xAt(f);
      const y = curve.yAt(f);
      this.revealW.set(x + 0.75);
      this.dotX.set(x);
      this.dotY.set(y);
      return { x, y };
    };

    const writeLabels = (idx: number, x: number, y: number) => {
      const pt = this.chartPoints[idx];
      if (!pt) return;

      this.year.set(String(pt.year));
      this.valueHtml.set(
        `<span style="color:var(--up)">${formatInteger(pt.value)} ₺</span> ` +
          `<span style="color:var(--muted);font-size:12px">(${lotsLabel(pt.lots)})</span>`,
      );

      const leftPct = (x / CHART_W) * 100;
      const topPct = (y / CHART_H) * 100;
      this.headChip.set({
        leftPct: Math.min(99, leftPct),
        topPct,
        flip: leftPct > 84,
        pinLeft: leftPct < 12,
        below: topPct < 34,
        dateLabel: pt.dateLabel,
        priceLabel: `${formatPrice(pt.price)} ₺`,
        valueLabel: `${formatInteger(pt.value)} ₺`,
      });
    };

    const finish = () => {
      this.revealW.set(CHART_W);
      this.dotX.set(lastX);
      this.dotY.set(curve.yAt(n - 1));
      this.dotVisible.set(true);
      this.animating.set(false);
      this.headChip.set(null);
      this.year.set(String(frames[n - 1].year));
      this.valueHtml.set(
        `<span style="color:var(--up)">${formatInteger(frames[n - 1].value)} ₺</span> ` +
          `<span style="color:var(--muted);font-size:12px">(${lotsLabel(lots)})</span>`,
      );
      this.event.set('🏁 Bugüne ulaştın!');
    };

    if (this.reducedMotion || n < 2) {
      finish();
      return;
    }

    this.revealW.set(0);
    this.dotVisible.set(true);
    this.animating.set(true);
    this.event.set('');

    const duration = Math.min(
      REPLAY_MAX_MS,
      Math.max(REPLAY_MIN_MS, n * REPLAY_MS_PER_POINT),
    );
    const startedAt = performance.now();
    let scannedIdx = 0;
    let labelAt = 0;
    let eventHoldUntil = 0;
    let lastEventYear: number | null = null;

    const frame = (now: number) => {
      const p = Math.min(1, (now - startedAt) / duration);
      const f = p * (n - 1);
      const { x, y } = moveHead(f);

      const idx = Math.min(n - 1, Math.floor(f));

      if (now - labelAt >= LABEL_THROTTLE_MS) {
        labelAt = now;
        writeLabels(idx, x, y);
      }

      // Günlük seride bir karede birden çok gün geçiliyor; olayları atlamamak için tara
      let crossed: LotEventMarker | undefined;
      while (scannedIdx <= idx) {
        const ev = this.chartPoints[scannedIdx]?.lotEvent;
        if (ev) crossed = ev;
        scannedIdx++;
      }

      if (crossed) {
        this.event.set(
          crossed.story ??
            `${crossed.label} (${crossed.actionDateLabel}) · ${compactLotRange(crossed.lotsBefore, crossed.lotsAfter)} lot`,
        );
        eventHoldUntil = now + EVENT_HOLD_MS;
      } else if (now >= eventHoldUntil) {
        const yearStory = SIMULATION_EVENTS[frames[idx].year];
        if (yearStory) {
          if (lastEventYear !== frames[idx].year) {
            this.event.set(yearStory);
            lastEventYear = frames[idx].year;
          }
        } else {
          this.event.set('');
        }
      }

      if (p < 1) {
        this.rafId = requestAnimationFrame(frame);
      } else {
        this.rafId = undefined;
        finish();
      }
    };

    const head = moveHead(0);
    writeLabels(0, head.x, head.y);
    this.rafId = requestAnimationFrame(frame);
  }

  private stop(): void {
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    this.animating.set(false);
    this.headChip.set(null);
  }
}

function formatPrice(value: number): string {
  const digits = value >= 100 ? 0 : value >= 1 ? 2 : 4;
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Backend ayı 1–12 gönderir */
function monthLabel(month: number): string {
  if (month >= 1 && month <= 12) return MONTHS_TR[month - 1];
  if (month >= 0 && month <= 11) return MONTHS_TR[month];
  return '';
}

/**
 * Backend günlük seriyi (gerçek kapanışlar) gönderiyorsa grafik gün gün ilerler;
 * göndermiyorsa eski aylık seriye düşer.
 */
function buildFrames(data: TimeMachineCalc, lotSeries: number[]): Frame[] {
  const lotByMonth = new Map<number, number>();
  data.series.forEach((p, i) => lotByMonth.set(p.year * 12 + p.month, lotSeries[i] ?? data.lots));

  const daily = data.dailySeries;
  if (
    daily &&
    daily.days.length >= 2 &&
    daily.prices.length === daily.days.length &&
    daily.values.length === daily.days.length
  ) {
    const [sy, sm, sd] = daily.startDate.split('-').map(Number);
    let carried = data.initialLots || data.lots;

    return daily.days.map((offset, i) => {
      // Gün ekleyerek ilerle: sabit ms eklemek yaz saati sınırlarında günü kaydırabiliyor
      const d = new Date(sy, sm - 1, sd + offset);
      const month = d.getMonth() + 1;
      carried = lotByMonth.get(d.getFullYear() * 12 + month) ?? carried;
      return {
        time: d.getTime(),
        year: d.getFullYear(),
        month,
        day: d.getDate(),
        price: daily.prices[i],
        value: daily.values[i],
        lots: carried,
      };
    });
  }

  return data.series.map((p, i) => {
    const d = new Date(p.year, p.month, 0);
    return {
      time: d.getTime(),
      year: p.year,
      month: p.month,
      day: d.getDate(),
      price: p.price,
      value: data.valueSeries[i],
      lots: lotSeries[i] ?? data.lots,
    };
  });
}

/** Tarihi >= hedef olan ilk kare (kareler zaman sıralı) */
function findFrameIndex(frames: Frame[], year: number, month: number, day: number): number {
  const target = new Date(year, month - 1, day > 0 ? day : 1).getTime();
  let lo = 0;
  let hi = frames.length - 1;
  let best = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].time >= target) {
      best = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  return best >= 0 ? best : frames.length - 1;
}

function buildChartLayout(data: TimeMachineCalc) {
  const { series, lots } = data;
  const lotSeries = normalizeLotSeries(data);
  const lotEvents = resolveLotEvents(series, lotSeries, data);
  const frames = buildFrames(data, lotSeries);
  const valueSeries = frames.map((f) => f.value);
  const daily = frames.length > series.length;

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
    frames.length <= 1 ? CHART_W / 2 : (i / (frames.length - 1)) * (CHART_W - 20) + 10;

  const yAt = (v: number) => {
    const t = useLog
      ? (Math.log10(Math.max(v, 1e-6)) - logMin) / logRange
      : (v - min) / linRange;
    return CHART_H - PLOT_BOTTOM - Math.min(1, Math.max(0, t)) * plotH;
  };

  /** yAt'ın tersi — eğri üzerindeki ara noktanın gerçek portföy değeri */
  const vAt = (y: number) => {
    const t = Math.min(1, Math.max(0, (CHART_H - PLOT_BOTTOM - y) / plotH));
    return useLog ? Math.pow(10, logMin + t * logRange) : min + t * linRange;
  };

  const eventIndex = new Map<LotEventMarker, number>();
  const eventsByIndex = new Map<number, LotEventMarker>();
  for (const ev of lotEvents) {
    const idx = findFrameIndex(frames, ev.year, ev.month, ev.day ?? 0);
    eventIndex.set(ev, idx);
    eventsByIndex.set(idx, ev);
  }

  const points: ChartPoint[] = frames.map((f, i) => ({
    svgX: xAt(i),
    svgY: yAt(f.value),
    value: f.value,
    price: f.price,
    year: f.year,
    month: f.month,
    dateLabel: daily
      ? `${f.day} ${monthLabel(f.month)} ${f.year}`
      : `${monthLabel(f.month)} ${f.year}`,
    lots: f.lots ?? lots,
    lotEvent: eventsByIndex.get(i),
  }));

  const rawMarkers: LotMarkerView[] = lotEvents
    .map((marker, i) => {
      const idx = eventIndex.get(marker);
      if (idx === undefined) return null;
      const svgY = yAt(frames[idx].value);
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
  frames.forEach((f, i) => {
    if (seenYears.has(f.year)) return;
    seenYears.add(f.year);
    yearCandidates.push({ leftPct: (xAt(i) / CHART_W) * 100, year: f.year });
  });
  // İlk yıl çoğu zaman kısmi (ör. Ekim'de alım) — etiketi hemen yanındakine yapışıyor
  const spaced =
    yearCandidates.length > 2 &&
    yearCandidates[1].leftPct - yearCandidates[0].leftPct < MIN_YEAR_GAP_PCT
      ? yearCandidates.slice(1)
      : yearCandidates;

  const yearGrids: YearGrid[] = [];
  for (const g of spaced) {
    if (!yearGrids.length || g.leftPct - yearGrids[yearGrids.length - 1].leftPct >= MIN_YEAR_GAP_PCT)
      yearGrids.push(g);
  }

  const curve = buildSmoothCurve(
    points.map((p) => p.svgX),
    points.map((p) => p.svgY),
    CHART_H - PLOT_BOTTOM,
  );

  return { frames, points, markers: rawMarkers, yearGrids, xAt, yAt, vAt, curve, daily, useLog };
}

interface SmoothCurve {
  linePath: string;
  areaPath: string;
  /** Kesirli indekste eğrinin y'si — nokta tam çizginin üstünde durur */
  yAt(f: number): number;
}

/**
 * Monoton kübik (Fritsch–Carlson) enterpolasyon: köşeleri yumuşatır ama
 * veriyi uydurmaz — aradaki x'ler eşit aralıklı olduğu için x(t) lineer kalır.
 */
function buildSmoothCurve(xs: number[], ys: number[], floorY: number): SmoothCurve {
  const n = ys.length;
  if (n === 0) return { linePath: '', areaPath: '', yAt: () => floorY };
  if (n === 1) {
    const d = `M ${r(xs[0])} ${r(ys[0])}`;
    return { linePath: d, areaPath: `${d} L ${r(xs[0])} ${floorY} Z`, yAt: () => ys[0] };
  }

  // Günlük seride noktalar zaten piksel altı aralıkta; düz segment hem daha hızlı
  // hem de gerçek dalgalanmayı olduğu gibi gösteriyor.
  if (n > SMOOTHING_MAX_POINTS) {
    let straight = `M ${r(xs[0])} ${r(ys[0])}`;
    for (let i = 1; i < n; i++) straight += ` L ${r(xs[i])} ${r(ys[i])}`;
    return {
      linePath: straight,
      areaPath: `${straight} L ${r(xs[n - 1])} ${floorY} L ${r(xs[0])} ${floorY} Z`,
      yAt: (f: number) => {
        const i = Math.min(n - 2, Math.max(0, Math.floor(f)));
        const t = Math.min(1, Math.max(0, f - i));
        return ys[i] + (ys[i + 1] - ys[i]) * t;
      },
    };
  }

  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) delta.push(ys[i + 1] - ys[i]);

  const m: number[] = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = (delta[i - 1] + delta[i]) / 2;

  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * delta[i];
      m[i + 1] = t * b * delta[i];
    }
  }

  let d = `M ${r(xs[0])} ${r(ys[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    d +=
      ` C ${r(xs[i] + dx / 3)} ${r(ys[i] + m[i] / 3)},` +
      ` ${r(xs[i + 1] - dx / 3)} ${r(ys[i + 1] - m[i + 1] / 3)},` +
      ` ${r(xs[i + 1])} ${r(ys[i + 1])}`;
  }

  return {
    linePath: d,
    areaPath: `${d} L ${r(xs[n - 1])} ${floorY} L ${r(xs[0])} ${floorY} Z`,
    yAt: (f: number) => {
      const i = Math.min(n - 2, Math.max(0, Math.floor(f)));
      const t = Math.min(1, Math.max(0, f - i));
      const p0 = ys[i];
      const p1 = ys[i] + m[i] / 3;
      const p2 = ys[i + 1] - m[i + 1] / 3;
      const p3 = ys[i + 1];
      const u = 1 - t;
      return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    },
  };
}

function r(n: number): number {
  return Math.round(n * 100) / 100;
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
