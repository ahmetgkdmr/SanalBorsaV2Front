import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getMinimumWage } from '../../core/constants/app.constants';
import { TimeMachineCalc, TimeMachineMode } from '../../core/models/time-machine.model';
import { MarketService } from '../../core/services/market.service';
import { IndexService } from '../../core/services/index.service';
import { ModalService } from '../../core/services/modal.service';
import {
  formatInteger,
  formatNumber,
  formatTurkishDate,
  formatLotRange,
  symbolColor,
} from '../../core/utils/format.util';
import { isForexSymbol, isIndexSymbol } from '../../core/models/index.model';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';
import { TimeMachineSimulationComponent } from './time-machine-simulation.component';

type InvestMode = 'wage' | 'custom';

@Component({
  selector: 'app-time-machine-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, FormsModule, TimeMachineSimulationComponent, DatePickerComponent],
  template: `
    <app-overlay [open]="modals.active() === 'timeMachine'" (closed)="onClose()">
      <div class="modal">
        <button class="m-close" type="button" (click)="onClose()">✕</button>
        <h2>🕰️ Zaman Makinesi <span class="prem-tag">PREMIUM · şimdilik herkese açık</span></h2>
        <p class="sub">{{ subtitle() }}</p>

        <!-- ── Sembol seçimi ───────────────────────────────── -->
        <div class="tm-section">
          <div class="tm-label">{{ instrumentLabel() }}</div>
          <div class="stock-pick">
            <div class="pick-logo" [style.background]="logoColor()">{{ symbol().slice(0, 2) }}</div>
            <select class="f-input" [ngModel]="symbol()" (ngModelChange)="onSymbolChange($event)">
              @if (forexOptions().length) {
                <optgroup label="Döviz">
                  @for (opt of forexOptions(); track opt.symbol) {
                    <option [value]="opt.symbol">{{ opt.label }}</option>
                  }
                </optgroup>
              }
              <optgroup label="Hisseler">
                @for (s of stockOptions(); track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </optgroup>
            </select>
          </div>
          <p class="idx-note">
            BIST endekslerinde Zaman Makinesi yok — endeks bileşimi değişir; temettü / bedelli / bedelsiz
            hisse bazında yansıtılamaz.
          </p>
        </div>

        <!-- ── Tarih seçici ───────────────────────────────── -->
        <div class="tm-section">
          <div class="tm-label">TARİH SEÇ</div>
          <app-date-picker
            [value]="dateStr()"
            (valueChange)="onDateChange($event)"
            [minDate]="minDateStr()"
            [maxDate]="todayStr"
            [hint]="calendarHint()"
          />
        </div>

        <!-- ── Alım şekli ─────────────────────────────────── -->
        <div class="tm-section">
          <div class="tm-label">ALIM ŞEKLİ</div>
          <div class="seg">
            <button type="button" [class.active]="mode() === 'lump'" (click)="setMode('lump')">
              💰 Tek Seferlik
            </button>
            <button type="button" [class.active]="mode() === 'dca'" (click)="setMode('dca')">
              📅 Her Ay Düzenli
            </button>
          </div>
        </div>

        <!-- ── Yatırım tutarı ─────────────────────────────── -->
        <div class="tm-section">
          <div class="tm-label">YATIRIM TUTARI</div>
          <div class="seg invest-mode-seg">
            <button type="button" [class.active]="investMode() === 'wage'" (click)="setInvestMode('wage')">
              🏦 Asgari Ücret Bazlı
            </button>
            <button type="button" [class.active]="investMode() === 'custom'" (click)="setInvestMode('custom')">
              ✏️ Özel Tutar
            </button>
          </div>

          @if (investMode() === 'wage') {
            <div class="wage-block">
              <div class="pct-row">
                <span class="tm-label" style="margin:0">ASGARİ ÜCRETİN YÜZDE KAÇI?</span>
                <b class="pct-val mono">%{{ pct() }}</b>
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
          } @else {
            <div class="custom-block">
              <div class="custom-input-wrap">
                <input
                  type="number"
                  class="f-input custom-amount-input"
                  [ngModel]="customAmount()"
                  (ngModelChange)="onCustomAmountChange($event)"
                  placeholder="Tutar girin (₺)"
                  min="1"
                  step="100"
                />
                <span class="currency-badge">₺</span>
              </div>
              <div class="wage-info">
                {{ mode() === 'dca' ? 'Her ay' : 'Tek seferinde' }}
                <b>{{ formatInteger(customAmount()) }} ₺</b> yatırılacak.
              </div>
            </div>
          }
        </div>

        <!-- ── Aksiyon butonları ──────────────────────────── -->
        <div class="tm-actions">
          <button class="btn btn-main" type="button" (click)="calculate()" [disabled]="loading()">
            {{ loading() ? 'Hesaplanıyor…' : 'Hesapla' }}
          </button>
          <button class="btn btn-prem" type="button" [disabled]="!canSimulate()" (click)="runSim()">
            ✨ Simüle Et
          </button>
        </div>

        <!-- ── Sonuç ──────────────────────────────────────── -->
        @if (calc(); as r) {
          @if (r.error) {
            <div class="result show">
              <p class="headline err">{{ r.error }}</p>
            </div>
          } @else {
            <div class="result show">
              <p class="headline">
                <span class="big">{{ formatInteger(r.currentValue) }} ₺</span> bugünkü değer —
                <span [class.neg]="r.gainPct < 0">
                  {{ r.gainPct >= 0 ? '+' : '' }}%{{ formatNumber(r.gainPct) }}
                </span>
              </p>

              @if (r.storyLines.length) {
                <div class="story">
                  @for (line of r.storyLines; track $index) {
                    <p class="story-line">{{ line }}</p>
                  }
                </div>
              }

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
                  <div class="k">{{ lotLabel() }}</div>
                  <div class="v mono" [class.lot-growth]="r.initialLots !== r.lots">
                    {{ formatLotRange(r.initialLots, r.lots) }}
                  </div>
                  @if (r.initialLots !== r.lots && !isInstrumentMode()) {
                    <div class="k sub">başlangıç → bugün</div>
                  }
                </div>
                <div class="stat">
                  <div class="k">BUGÜN</div>
                  <div class="v mono">{{ formatNumber(r.currentPrice) }} ₺</div>
                </div>
                @if (!isInstrumentMode() && r.dividendsReceived > 0) {
                  <div class="stat">
                    <div class="k">TEMETTÜ</div>
                    <div class="v mono">{{ formatInteger(r.dividendsReceived) }} ₺</div>
                    <div class="k sub">toplam gelir</div>
                  </div>
                  <div class="stat">
                    <div class="k">GERİ YATIRILAN</div>
                    <div class="v mono accent">{{ formatInteger(r.dividendsReinvested) }} ₺</div>
                    @if (r.lotsFromReinvestment > 0) {
                      <div class="k sub">+{{ formatInteger(r.lotsFromReinvestment) }} lot</div>
                    }
                  </div>
                }
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

      b { color: var(--text); font-size: 13px; }
    }

    .stock-pick {
      display: flex;
      gap: 10px;
      align-items: center;
      select { flex: 1; }
    }

    .idx-note {
      margin: 8px 0 0;
      font-size: 11.5px;
      line-height: 1.45;
      color: var(--muted);
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

    /* Tarih seçici host genişliği */
    app-date-picker { display: block; }

    /* ── Segment butonlar ─────────────────────────────────── */
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
        transition: 0.18s;

        &:hover { color: var(--text); }
        &.active { background: var(--accent); color: #1a1206; }
      }
    }

    .invest-mode-seg { margin-bottom: 14px; }

    /* ── Wage block ──────────────────────────────────────── */
    .wage-block { margin-top: 2px; }

    .pct-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .pct-val {
      font-size: 20px;
      font-weight: 700;
      color: var(--text);
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

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--accent);
        cursor: pointer;
        border: 2px solid var(--bg);
      }
    }

    /* ── Custom amount block ─────────────────────────────── */
    .custom-block { margin-top: 2px; }

    .custom-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .custom-amount-input {
      width: 100%;
      font-size: 22px;
      font-weight: 700;
      padding: 14px 52px 14px 18px;
      border-radius: 14px;
      letter-spacing: 0.5px;

      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button { -webkit-appearance: none; }
    }

    .currency-badge {
      position: absolute;
      right: 16px;
      font-size: 18px;
      font-weight: 700;
      color: var(--muted);
      pointer-events: none;
    }

    /* ── Wage info ────────────────────────────────────────── */
    .wage-info {
      margin-top: 9px;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.6;

      b { color: var(--text); }
    }

    /* ── Actions ─────────────────────────────────────────── */
    .tm-actions {
      display: flex;
      gap: 10px;
      margin-top: 24px;
      flex-wrap: wrap;
    }

    .btn-main, .btn-prem {
      flex: 1;
      justify-content: center;
      min-width: 140px;
    }

    .btn-prem:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    /* ── Sonuç ───────────────────────────────────────────── */
    .result {
      margin-top: 24px;
      border-top: 1px dashed var(--line);
      padding-top: 22px;

      &.show { animation: tmIn 0.3s; }
    }

    .headline {
      font-size: 15px;
      line-height: 1.65;

      &.err { color: var(--down); font-size: 13px; }

      .big { font-size: 26px; font-weight: 800; color: var(--up); }
      .neg { color: var(--down); }
    }

    .story {
      margin: 14px 0 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .story-line {
      margin: 0;
      padding: 10px 12px;
      border-left: 3px solid var(--accent);
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      border-radius: 0 10px 10px 0;
      font-size: 13px;
      line-height: 1.55;
      color: var(--text);
    }

    .stat .v.accent { color: var(--accent); }

    .lot-growth { color: var(--prem); }

    .stat .k.sub {
      margin-top: 4px;
      font-size: 9px;
      opacity: 0.75;
    }

    @keyframes tmIn {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: none; }
    }
  `,
})
export class TimeMachineModalComponent {
  readonly modals = inject(ModalService);
  private readonly market = inject(MarketService);
  private readonly indexService = inject(IndexService);

  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;
  readonly formatLotRange = formatLotRange;
  readonly isInstrumentMode = computed(
    () => isIndexSymbol(this.symbol()) || isForexSymbol(this.symbol()),
  );

  readonly symbol    = signal('THYAO');
  readonly mode      = signal<TimeMachineMode>('lump');
  readonly pct       = signal(50);
  readonly investMode = signal<InvestMode>('wage');
  readonly customAmount = signal(5000);
  readonly loading   = signal(false);
  readonly calc      = signal<TimeMachineCalc | null>(null);
  readonly showSim   = signal(false);
  readonly simTrigger = signal(0);

  // ── Seçili tarih — veri gelince earliest'e snap edilir
  dateStr = signal('');
  readonly todayStr = new Date().toISOString().slice(0, 10);

  // ── Erken tarih sınırı ───────────────────────────────
  readonly minDateStr = computed<string>(() => {
    const sym = this.symbol();
    if (isIndexSymbol(sym) || isForexSymbol(sym)) {
      const q = this.indexService.quotes().find((q) => q.symbol === sym);
      if (q?.earliestDate) return q.earliestDate.slice(0, 10);
      return '';
    }
    const d = this.market.getEarliestDate(sym);
    return d ? d.slice(0, 10) : '';
  });

  /** Takvim üstünde gösterilecek hint metni */
  readonly calendarHint = computed<string>(() => {
    const sym = this.symbol();
    const min = this.minDateStr();
    if (!min) return `${sym} için fiyat geçmişi yükleniyor…`;
    const d = new Date(min + 'T12:00:00');
    const label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${sym} için varsayılan başlangıç: ${label}`;
  });

  readonly dateLabel = computed(() => formatTurkishDate(this.dateStr()));
  readonly logoColor = computed(() => symbolColor(this.symbol()));

  // ── Stock / index seçenekleri ─────────────────────────
  readonly stockOptions = computed(() => {
    const symbols = this.market.symbolOptions();
    return symbols.length ? symbols : ['THYAO', 'GARAN', 'AKBNK'];
  });

  readonly forexOptions = computed(() =>
    this.indexService
      .quotes()
      .filter((q) => isForexSymbol(q.symbol))
      .map((q) => ({ symbol: q.symbol, label: q.displayName })),
  );

  readonly instrumentLabel = computed(() =>
    isForexSymbol(this.symbol()) ? 'DÖVİZ SEÇ' : 'HİSSE SEÇ',
  );

  readonly subtitle = computed(() => {
    if (isForexSymbol(this.symbol()))
      return 'O tarihte belirlediğin tutarla dolar alsaydın bugün ne olurdu?';
    return 'O tarihte belirlediğin tutarla bu hisseyi alsaydın bugün ne olurdu?';
  });

  readonly lotLabel = computed(() => {
    if (isForexSymbol(this.symbol())) return 'USD MİKTARI';
    return 'LOT';
  });

  readonly wageInfo = computed(() => {
    const iso = this.dateStr();
    if (!iso || iso.length < 7) return 'Asgari ücret için tarih seç…';
    const year = +iso.slice(0, 4);
    const month = +iso.slice(5, 7);
    const wage = getMinimumWage(iso);
    const inv = wage * (this.pct() / 100);
    const totalMonths = (new Date().getFullYear() - year) * 12 - (month - 1);
    const fmt = (n: number) =>
      n >= 100 ? formatInteger(n) : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const modeTxt =
      this.mode() === 'lump'
        ? `tek seferde: <b>${fmt(inv)} ₺</b>`
        : `her ay: <b>${fmt(inv)} ₺</b> × ~${Math.max(totalMonths, 1)} ay`;
    const note =
      year < 2005
        ? ` <span style="opacity:.7">(2005 öncesi Yeni TL karşılığı)</span>`
        : '';
    return `${year} asgari ücreti: <b>${fmt(wage)} ₺</b>${note} → ${modeTxt}`;
  });

  readonly canSimulate = computed(
    () => !!this.calc() && !this.calc()!.error && this.calc()!.valueSeries.length > 0,
  );

  constructor() {
    // Modal açılınca sembolü ayarla ve tarihi en erken tarihe sıfırla
    effect(() => {
      if (this.modals.active() !== 'timeMachine') return;
      const sym = this.modals.stockSymbol();
      if (sym) {
        // Endeks seçildiyse hisseye düş (bileşim / temettü yansıtılamaz)
        this.symbol.set(isIndexSymbol(sym) ? 'THYAO' : sym);
      }
      if (!this.market.symbolOptions().length) this.market.loadMarket();
      if (!this.indexService.quotes().length) this.indexService.loadQuotes();
    });

    // Modal açılınca veya sembol değişince takvimi hissenin ilk fiyat tarihine al
    effect(() => {
      if (this.modals.active() !== 'timeMachine') return;
      const min = this.minDateStr();
      if (min) this.dateStr.set(min);
    });
  }

  onClose(): void {
    this.showSim.set(false);
    this.modals.close();
  }

  onSymbolChange(sym: string): void {
    if (isIndexSymbol(sym)) return;
    this.symbol.set(sym);
    this.resetCalc();
  }

  onDateChange(iso: string): void {
    this.dateStr.set(iso);
    this.resetCalc();
  }

  onPctChange(val: number): void {
    this.pct.set(+val);
    this.resetCalc();
  }

  onCustomAmountChange(val: number): void {
    this.customAmount.set(+val || 0);
    this.resetCalc();
  }

  setMode(m: TimeMachineMode): void {
    this.mode.set(m);
    this.resetCalc();
  }

  setInvestMode(m: InvestMode): void {
    this.investMode.set(m);
    this.resetCalc();
  }

  resetCalc(): void {
    this.calc.set(null);
    this.showSim.set(false);
    this.simTrigger.set(0);
  }

  calculate(): void {
    if (isIndexSymbol(this.symbol())) {
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
        lotEvents: [],
        dateLabel: this.dateLabel(),
        dividendsReceived: 0,
        dividendsReinvested: 0,
        lotsFromReinvestment: 0,
        cashRemaining: 0,
        storyLines: [],
        error:
          'Endeksler için Zaman Makinesi desteklenmiyor. Endeks bileşimi değişir; temettü / bedelli / bedelsiz hisse bazında yansıtılamaz. Bir hisse veya döviz seç.',
      });
      return;
    }

    this.loading.set(true);
    this.showSim.set(false);

    const amount =
      this.investMode() === 'custom' && this.customAmount() > 0
        ? this.customAmount()
        : undefined;

    this.market
      .calculateInvestment(this.symbol(), this.dateStr(), this.pct(), this.mode(), amount)
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
            lotEvents: [],
            dateLabel: this.dateLabel(),
            dividendsReceived: 0,
            dividendsReinvested: 0,
            lotsFromReinvestment: 0,
            cashRemaining: 0,
            storyLines: [],
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
