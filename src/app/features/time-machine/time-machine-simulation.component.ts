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
import { SIMULATION_EVENTS, TimeMachineCalc } from '../../core/models/time-machine.model';
import { formatInteger, formatLotRange } from '../../core/utils/format.util';

interface YearGrid {
  x: number;
  year: number;
}

interface ChartPoint {
  svgX: number;
  svgY: number;
  value: number;
  year: number;
  month: number;
  lots: number;
}

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

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

        @if (hoverTip(); as tip) {
          <div class="chart-tip" [style.left.%]="tip.leftPct" [style.top.%]="tip.topPct">
            <div class="tip-date">{{ tip.dateLabel }}</div>
            <div class="tip-val">{{ tip.valueLabel }}</div>
            @if (tip.lotsLabel) {
              <div class="tip-lots">{{ tip.lotsLabel }}</div>
            }
          </div>
        }
      </div>

      <div class="sim-note">Grafiğin üzerine gel — o anki portföy değerini gör · kritik yıllarda animasyon yavaşlar</div>
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

      &.show {
        display: block;
      }
    }

    .sim-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .sim-year {
      font-size: 30px;
      font-weight: 800;
    }

    .sim-val {
      font-size: 19px;
      font-weight: 600;
    }

    .sim-event {
      min-height: 22px;
      font-size: 12.5px;
      color: var(--prem);
      font-weight: 600;
      margin-bottom: 8px;
    }

    .chart-wrap {
      position: relative;
    }

    svg {
      width: 100%;
      height: 240px;
      display: block;
      cursor: crosshair;
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
      z-index: 2;
    }

    .tip-date {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
    }

    .tip-val {
      font-size: 15px;
      font-weight: 800;
      color: var(--up);
      margin-top: 2px;
    }

    .tip-lots {
      font-size: 11px;
      color: var(--text);
      margin-top: 3px;
    }

    .sim-note {
      font-size: 11px;
      color: var(--muted);
      margin-top: 8px;
    }

    .replay {
      margin-top: 10px;
      background: var(--panel2);
      border: 1px solid var(--line);
      color: var(--text);
      font-size: 12.5px;
      padding: 9px 16px;
    }

    @keyframes tmIn {
      from {
        opacity: 0;
        transform: translateY(14px);
      }
      to {
        opacity: 1;
        transform: none;
      }
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
  readonly hoverPoint = signal<ChartPoint | null>(null);
  readonly hoverTip = signal<{
    leftPct: number;
    topPct: number;
    dateLabel: string;
    valueLabel: string;
    lotsLabel: string;
  } | null>(null);

  private chartPoints: ChartPoint[] = [];
  private animTimer?: ReturnType<typeof setTimeout>;
  private readonly reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly W = 1000;
  private readonly H = 240;

  constructor() {
    effect(() => {
      if (this.runTrigger() > 0) {
        this.start();
      }
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
    const svgX = ((event.clientX - rect.left) / rect.width) * this.W;

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
    this.hoverPoint.set(pt);
    this.hoverTip.set({
      leftPct: (pt.svgX / this.W) * 100,
      topPct: (pt.svgY / this.H) * 100,
      dateLabel: `${MONTHS_TR[pt.month] ?? ''} ${pt.year}`,
      valueLabel: `${formatInteger(pt.value)} ₺`,
      lotsLabel:
        data.initialLots !== pt.lots
          ? `${formatLotRange(data.initialLots, pt.lots)} lot`
          : `${pt.lots.toLocaleString('tr-TR')} lot`,
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

    const { series, valueSeries, lotSeries, initialLots, lots } = data;
    const min = Math.min(...valueSeries);
    const max = Math.max(...valueSeries);
    const range = max - min || 1;

    const xAt = (i: number) => (i / (series.length - 1)) * (this.W - 20) + 10;
    const yAt = (v: number) => this.H - 18 - ((v - min) / range) * (this.H - 46);

    this.chartPoints = series.map((p, i) => ({
      svgX: xAt(i),
      svgY: yAt(valueSeries[i]),
      value: valueSeries[i],
      year: p.year,
      month: p.month,
      lots: lotSeries[i] ?? lots,
    }));

    const yearGrids: YearGrid[] = [];
    series.forEach((p, i) => {
      if (p.month === 0) yearGrids.push({ x: xAt(i), year: p.year });
    });
    this.grid.set(yearGrids);

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
      this.areaPath.set(`${d} L ${x} ${this.H - 18} L 10 ${this.H - 18} Z`);
      this.dotX.set(x);
      this.dotY.set(y);
      this.dotVisible.set(true);
      this.year.set(String(p.year));

      const curLots = lotSeries[i] ?? lots;
      this.valueHtml.set(
        `<span style="color:var(--up)">${formatInteger(valueSeries[i])} ₺</span> ` +
          `<span style="color:var(--muted);font-size:12px">(${lotsLabel(curLots)})</span>`,
      );

      if (SIMULATION_EVENTS[p.year] && lastEventYear !== p.year) {
        this.event.set(SIMULATION_EVENTS[p.year]);
        lastEventYear = p.year;
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
        this.areaPath.set(`${d} L ${xAt(series.length - 1)} ${this.H - 18} L 10 ${this.H - 18} Z`);
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
