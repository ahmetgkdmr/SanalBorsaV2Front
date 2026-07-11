import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MINIMUM_WAGE_BY_YEAR } from '../../core/constants/app.constants';
import { TimeMachineCalc, TimeMachineMode } from '../../core/models/time-machine.model';
import { MarketService } from '../../core/services/market.service';
import { ModalService } from '../../core/services/modal.service';
import { formatInteger, formatNumber, formatTurkishDate, formatLotRange, symbolColor } from '../../core/utils/format.util';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';
import { TimeMachineSimulationComponent } from './time-machine-simulation.component';

@Component({
  selector: 'app-time-machine-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, FormsModule, TimeMachineSimulationComponent],
  template: `
    <app-overlay [open]="modals.active() === 'timeMachine'" (closed)="onClose()">
      <div class="modal">
        <button class="m-close" type="button" (click)="onClose()">✕</button>
        <h2>🕰️ Zaman Makinesi <span class="prem-tag">PREMIUM · şimdilik herkese açık</span></h2>
        <p class="sub">O tarihte asgari ücretinin bir kısmıyla bu hisseyi alsaydın bugün ne olurdu?</p>

        <div class="tm-section">
          <div class="tm-label">HİSSE SEÇ</div>
          <div class="stock-pick">
            <div class="pick-logo" [style.background]="logoColor()">{{ symbol().slice(0, 2) }}</div>
            <select class="f-input" [ngModel]="symbol()" (ngModelChange)="onSymbolChange($event)">
              @for (s of stockOptions(); track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>
          </div>
        </div>

        <div class="tm-section">
          <div class="tm-label">
            TARİH SEÇ (takvimden gün + yıl) <b>{{ dateLabel() }}</b>
          </div>
          <input
            type="date"
            class="f-input"
            [(ngModel)]="date"
            [min]="minDate"
            [max]="maxDate"
            (ngModelChange)="resetCalc()"
          />
        </div>

        <div class="tm-section">
          <div class="tm-label">ALIM ŞEKLİ</div>
          <div class="seg">
            <button
              type="button"
              [class.active]="mode() === 'lump'"
              (click)="setMode('lump')"
            >
              💰 Tek Seferlik (seçtiğin gün)
            </button>
            <button
              type="button"
              [class.active]="mode() === 'dca'"
              (click)="setMode('dca')"
            >
              📅 Her Ay Düzenli (o günden itibaren)
            </button>
          </div>
        </div>

        <div class="tm-section">
          <div class="tm-label">
            ASGARİ ÜCRETİN YÜZDE KAÇI? <b class="pct-val mono">%{{ pct() }}</b>
          </div>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            [ngModel]="pct()"
            (ngModelChange)="onPctChange($event)"
            [style.--fill]="((pct() - 5) / 95 * 100) + '%'"
          />
          <div class="wage-info" [innerHTML]="wageInfo()"></div>
        </div>

        <div class="tm-actions">
          <button class="btn btn-main" type="button" (click)="calculate()" [disabled]="loading()">
            {{ loading() ? 'Hesaplanıyor…' : 'Hesapla' }}
          </button>
          <button class="btn btn-prem" type="button" [disabled]="!canSimulate()" (click)="runSim()">
            ✨ Simüle Et
          </button>
        </div>

        @if (calc(); as r) {
          @if (r.error) {
            <div class="result show">
              <p class="headline">{{ r.error }}</p>
            </div>
          } @else {
            <div class="result show">
              <p class="headline">
                <span class="big">{{ formatInteger(r.currentValue) }} ₺</span> bugünkü değer —
                <span [class.neg]="r.gainPct < 0">
                  {{ r.gainPct >= 0 ? '+' : '' }}%{{ formatNumber(r.gainPct) }}
                </span>
              </p>
              <div class="stat-grid">
                <div class="stat">
                  <div class="k">YATIRILAN</div>
                  <div class="v mono">{{ formatInteger(r.invested) }} ₺</div>
                </div>
                <div class="stat">
                  <div class="k">ALIM FİYATI</div>
                  <div class="v mono">{{ formatNumber(r.buyPrice) }} ₺</div>
                </div>
                <div class="stat">
                  <div class="k">LOT</div>
                  <div class="v mono" [class.lot-growth]="r.initialLots !== r.lots">
                    {{ formatLotRange(r.initialLots, r.lots) }}
                  </div>
                  @if (r.initialLots !== r.lots) {
                    <div class="k sub">bedelsiz / bölünme sonrası</div>
                  }
                </div>
                <div class="stat">
                  <div class="k">BUGÜN</div>
                  <div class="v mono">{{ formatNumber(r.currentPrice) }} ₺</div>
                </div>
              </div>
            </div>
          }
        }

        @if (showSim() && calc() && !calc()!.error) {
          <app-time-machine-simulation [calc]="calc()!" [runTrigger]="simTrigger()" />
        }
      </div>
    </app-overlay>
  `,
  styles: `
    .modal {
      max-width: 760px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 26px;
      position: relative;
    }

    h2 {
      font-size: 21px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .m-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--panel2);
      border: 1px solid var(--line);
      color: var(--muted);
      width: 34px;
      height: 34px;
      border-radius: 10px;
      cursor: pointer;
    }

    .tm-section {
      margin-top: 20px;
    }

    .tm-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: var(--muted);
      margin-bottom: 9px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;

      b {
        color: var(--text);
        font-size: 13px;
      }
    }

    .stock-pick {
      display: flex;
      gap: 10px;
      align-items: center;

      select {
        flex: 1;
      }
    }

    .pick-logo {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: #fff;
      font-size: 14px;
      flex: 0 0 auto;
    }

    .seg {
      display: flex;
      gap: 6px;
      background: var(--panel2);
      border: 1px solid var(--line);
      padding: 5px;
      border-radius: 12px;
      width: fit-content;
      max-width: 100%;
      flex-wrap: wrap;

      button {
        border: none;
        background: transparent;
        color: var(--muted);
        font-weight: 700;
        font-size: 12.5px;
        padding: 9px 14px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;

        &.active {
          background: var(--accent);
          color: #1a1206;
        }
      }
    }

    input[type='date'] {
      color-scheme: dark;
      width: 100%;
    }

    input[type='range'] {
      width: 100%;
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      border-radius: 6px;
      background: linear-gradient(90deg, var(--accent) var(--fill, 50%), var(--line) var(--fill, 50%));
      outline: none;
      cursor: pointer;
    }

    .pct-val {
      font-size: 20px;
      font-weight: 700;
    }

    .wage-info {
      margin-top: 9px;
      font-size: 12px;
      color: var(--muted);
    }

    .tm-actions {
      display: flex;
      gap: 10px;
      margin-top: 24px;
      flex-wrap: wrap;
    }

    .btn-main,
    .btn-prem {
      flex: 1;
      justify-content: center;
      min-width: 140px;
    }

    .btn-prem:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    .result {
      margin-top: 24px;
      border-top: 1px dashed var(--line);
      padding-top: 22px;

      &.show {
        animation: tmIn 0.3s;
      }
    }

    .headline {
      font-size: 15px;
      line-height: 1.65;

      .big {
        font-size: 26px;
        font-weight: 800;
        color: var(--up);
      }

      .neg {
        color: var(--down);
      }
    }

    .lot-growth {
      color: var(--prem);
    }

    .stat .k.sub {
      margin-top: 4px;
      font-size: 9px;
      opacity: 0.75;
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
export class TimeMachineModalComponent {
  readonly modals = inject(ModalService);
  private readonly market = inject(MarketService);

  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;
  readonly formatLotRange = formatLotRange;

  readonly symbol = signal('THYAO');
  date = '2015-06-15';
  readonly pct = signal(50);
  readonly mode = signal<TimeMachineMode>('lump');
  readonly loading = signal(false);
  readonly calc = signal<TimeMachineCalc | null>(null);
  readonly showSim = signal(false);
  readonly simTrigger = signal(0);

  readonly minDate = '2010-01-01';
  readonly maxDate = new Date().toISOString().slice(0, 10);

  readonly stockOptions = computed(() => {
    const symbols = this.market.symbolOptions();
    return symbols.length ? symbols : ['THYAO', 'GARAN', 'AKBNK'];
  });

  readonly dateLabel = computed(() => formatTurkishDate(this.date));
  readonly logoColor = computed(() => symbolColor(this.symbol()));

  readonly wageInfo = computed(() => {
    const year = +this.date.slice(0, 4);
    const wage = MINIMUM_WAGE_BY_YEAR[year] ?? MINIMUM_WAGE_BY_YEAR[2026];
    const inv = wage * (this.pct() / 100);
    const totalMonths = (2026 - year) * 12 - new Date(this.date + 'T12:00:00').getMonth();
    const modeTxt =
      this.mode() === 'lump'
        ? `o gün tek seferde: <b>${formatInteger(inv)} ₺</b>`
        : `o günden itibaren her ay: <b>${formatInteger(inv)} ₺</b> × ~${totalMonths} ay`;
    return `${year} asgari ücreti: <b>${formatInteger(wage)} ₺</b> → ${modeTxt} <span style="opacity:.6">(gerçek fiyat verisi)</span>`;
  });

  readonly canSimulate = computed(() => !!this.calc() && !this.calc()!.error && this.calc()!.valueSeries.length > 0);

  constructor() {
    effect(() => {
      if (this.modals.active() !== 'timeMachine') return;
      const sym = this.modals.stockSymbol();
      if (sym) this.symbol.set(sym);
      if (!this.market.symbolOptions().length) this.market.loadMarket();
    });
  }

  onClose(): void {
    this.showSim.set(false);
    this.modals.close();
  }

  onSymbolChange(sym: string): void {
    this.symbol.set(sym);
    this.resetCalc();
  }

  onPctChange(val: number): void {
    this.pct.set(+val);
    this.resetCalc();
  }

  setMode(m: TimeMachineMode): void {
    this.mode.set(m);
    this.resetCalc();
  }

  resetCalc(): void {
    this.calc.set(null);
    this.showSim.set(false);
    this.simTrigger.set(0);
  }

  calculate(): void {
    this.loading.set(true);
    this.showSim.set(false);
    this.market
      .calculateInvestment(this.symbol(), this.date, this.pct(), this.mode())
      .subscribe({
        next: (r) => {
          this.calc.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.calc.set({
            symbol: this.symbol(),
            mode: this.mode(),
            invested: 0,
            currentValue: 0,
            gainPct: 0,
            initialLots: 0,
            lots: 0,
            buyPrice: 0,
            currentPrice: 0,
            series: [],
            valueSeries: [],
            lotSeries: [],
            dateLabel: this.dateLabel(),
            error: 'Hesaplama başarısız. Backend bağlantısını kontrol et.',
          });
          this.loading.set(false);
        },
      });
  }

  runSim(): void {
    if (!this.canSimulate()) return;
    this.showSim.set(true);
    this.simTrigger.update((n) => n + 1);
  }
}
