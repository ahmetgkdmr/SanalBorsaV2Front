import { ChangeDetectionStrategy, Component, effect, input, OnDestroy, signal } from '@angular/core';
import { SIMULATION_EVENTS, TimeMachineCalc } from '../../core/constants/market.mock';
import { formatInteger } from '../../core/utils/format.util';

interface YearGrid {
  x: number;
  year: number;
}

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

      <svg viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden="true">
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
        <circle
          [attr.cx]="dotX()"
          [attr.cy]="dotY()"
          r="5"
          fill="var(--accent)"
          stroke="#1a1206"
          stroke-width="2"
          [attr.opacity]="dotVisible() ? 1 : 0"
        />
      </svg>

      <div class="sim-note">Yolculuk kritik yıllarda yavaşlar — grafiği izle 👀</div>
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

    svg {
      width: 100%;
      height: 240px;
      display: block;
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
  /** Her artışta animasyonu başlatır (parent ilk mount sonrası tetikler). */
  readonly runTrigger = input(0);

  readonly year = signal('—');
  readonly valueHtml = signal('');
  readonly event = signal('');
  readonly linePath = signal('');
  readonly areaPath = signal('');
  readonly dotX = signal(0);
  readonly dotY = signal(0);
  readonly dotVisible = signal(false);
  readonly grid = signal<YearGrid[]>([]);

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

  start(): void {
    this.stop();
    const data = this.calc();
    if (!data.valueSeries.length) return;

    const { series, valueSeries, mode, lots, lotSeries } = data;
    const min = Math.min(...valueSeries);
    const max = Math.max(...valueSeries);
    const range = max - min || 1;

    const xAt = (i: number) => (i / (series.length - 1)) * (this.W - 20) + 10;
    const yAt = (v: number) => this.H - 18 - ((v - min) / range) * (this.H - 46);

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

      const curLots = mode === 'dca' ? (lotSeries[i] ?? lots) : lots;
      this.valueHtml.set(
        `<span style="color:var(--up)">${formatInteger(valueSeries[i])} ₺</span> ` +
          `<span style="color:var(--muted);font-size:12px">(${curLots.toLocaleString('tr-TR')} lot)</span>`,
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
