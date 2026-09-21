import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getMinimumWage } from '../../core/constants/app.constants';
import { buildEraMoneyContext } from '../../core/utils/era-money.util';
import {
  TimeMachineCalc,
  TimeMachineLeader,
  TimeMachineLeaders,
  TimeMachineMode,
} from '../../core/models/time-machine.model';
import { MarketService } from '../../core/services/market.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { IndexService } from '../../core/services/index.service';
import { ModalService } from '../../core/services/modal.service';
import { CryptoApiService } from '../../core/services/crypto-api.service';
import { CryptoMarketService } from '../../core/services/crypto-market.service';
import { UsMarketService } from '../../core/services/us-market.service';
import { UsStockApiService } from '../../core/services/us-stock-api.service';
import {
  formatInteger,
  formatMoneyAmount,
  formatNumber,
  formatAssetPrice,
  formatTurkishDate,
  formatLotRange,
  symbolColor,
} from '../../core/utils/format.util';
import {
  PARITY_ICONS,
  PARITY_LABELS,
  PARITY_SYMBOLS,
  ParitySymbol,
  isForexSymbol,
  isIndexSymbol,
} from '../../core/models/index.model';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';
import { StockLogoComponent } from '../../shared/components/stock-logo/stock-logo.component';
import { TimeMachineSimulationComponent } from './time-machine-simulation.component';

type InvestMode = 'wage' | 'custom';

type PickerOption = {
  value: string;
  title: string;
  subtitle?: string;
  badge: string;
  color: string;
};

@Component({
  selector: 'app-time-machine-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    OverlayComponent,
    FormsModule,
    TimeMachineSimulationComponent,
    DatePickerComponent,
    StockLogoComponent,
  ],
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
            <app-stock-logo
              [symbol]="logoSymbol()"
              [color]="logoColor()"
              [market]="isCryptoTm() ? 'crypto' : isUsTm() ? 'us' : 'bist'"
            />
            <div class="sym-combo" [class.open]="pickerOpen()">
              <button
                type="button"
                class="sym-trigger f-input"
                (click)="togglePicker()"
                [attr.aria-expanded]="pickerOpen()"
              >
                <span class="sym-trigger-label">{{ selectedLabel() }}</span>
                <span class="sym-chevron" aria-hidden="true">▾</span>
              </button>

              @if (pickerOpen()) {
                <div class="sym-panel" role="listbox">
                  <input
                    class="sym-search"
                    type="search"
                    [placeholder]="isCryptoTm() ? 'Coin ara (BTC, ETH…)' : 'Hisse ara (THYAO…)'"
                    [ngModel]="pickerQuery()"
                    (ngModelChange)="onPickerQuery($event)"
                    (keydown.arrowDown)="onPickerNav($event, 1)"
                    (keydown.arrowUp)="onPickerNav($event, -1)"
                    (keydown.enter)="onPickerEnter($event)"
                    (keydown.escape)="closePicker()"
                    autocomplete="off"
                    spellcheck="false"
                    #pickerSearch
                  />
                  <ul class="sym-list">
                    @for (opt of pickerOptions(); track opt.value; let i = $index) {
                      <li
                        role="option"
                        [class.active]="i === pickerIndex()"
                        [class.selected]="opt.value === symbol()"
                        (mousedown)="pickSymbol(opt.value)"
                      >
                        <app-stock-logo
                          [symbol]="opt.value"
                          [color]="opt.color"
                          [market]="isCryptoTm() ? 'crypto' : isUsTm() ? 'us' : 'bist'"
                          size="sm"
                        />
                        <span class="opt-main">
                          <b>{{ opt.title }}</b>
                          @if (opt.subtitle) {
                            <span class="opt-sub">{{ opt.subtitle }}</span>
                          }
                        </span>
                        @if (opt.value === symbol()) {
                          <span class="opt-check">✓</span>
                        }
                      </li>
                    } @empty {
                      <li class="sym-empty">Eşleşen kayıt yok</li>
                    }
                  </ul>
                </div>
              }
            </div>
          </div>
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
        <div class="tm-section" #modeSection>
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
                <span class="tm-label" style="margin:0">KAÇ ASGARİ ÜCRET?</span>
                <b class="pct-val mono">{{ wageCount() }}×</b>
              </div>
              <div class="slider-wrap">
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  [ngModel]="wageCount()"
                  (ngModelChange)="onWageCountChange($event)"
                  [style.--fill]="(wageCount() / 5 * 100) + '%'"
                />
                <!-- Native thumb, gerçek (value-min)/(max-min) pozisyonunda kalır — value=1'de bu
                     hep sol uçtur. Sahte tutamak, doluluk yüzdesiyle (wageCount/5) aynı noktada
                     duruyor, value=1'de bile "boşta" değil "1'in sonunda" görünsün diye. -->
                <div class="slider-fake-thumb" [style.left]="(wageCount() / 5 * 100) + '%'"></div>
              </div>
              <div class="wage-info">
                @if (wageInfoView(); as w) {
                  {{ w.year }} asgari ücreti: <b>{{ w.wageLabel }} {{ w.oldTlNote ? 'TL' : '₺' }}</b>
                  @if (w.oldTlNote) {
                    <span class="wage-note">({{ w.wageNewTlLabel }} ₺ Yeni TL karşılığı)</span>
                  }
                  → {{ w.modePrefix }} <b>{{ w.investLabel }} {{ w.oldTlNote ? 'TL' : '₺' }}</b>
                  @if (w.oldTlNote) {
                    <span class="wage-note">({{ w.investNewTlLabel }} ₺ Yeni TL karşılığı)</span>
                  }
                  {{ w.modeSuffix }}
                } @else {
                  Asgari ücret için tarih seç…
                }
              </div>
            </div>
          } @else {
            <div class="custom-block">
              <div class="custom-input-wrap">
                <input
                  type="text"
                  inputmode="numeric"
                  class="f-input custom-amount-input"
                  [ngModel]="customAmountDisplay()"
                  (ngModelChange)="onCustomAmountInput($event)"
                  [placeholder]="customAmountPlaceholder()"
                />
                <span class="currency-badge">{{ isOldEra() ? 'TL' : '₺' }}</span>
              </div>

              @if (customAmountContext(); as c) {
                <div class="era-hint">
                  @if (c.newTlLabel) {
                    ⏳ <b>Eski TL</b> giriyorsun — {{ dateLabel() }} tarihinde tedavüldeki para buydu
                    (bugünkü birimle {{ c.newTlLabel }} ₺).
                  } @else {
                    ⏳ Girdiğin tutar <b>o günün parası</b>dır.
                  }
                  <div class="era-hint-wage">
                    {{ wageYearLabel() }} asgari ücreti <b>{{ c.wageThenLabel }}</b> idi —
                    bu tutar <b>≈ {{ c.wageCountLabel }}</b> ediyordu.
                  </div>
                  <div class="era-hint-today">
                    Aynı alım gücü bugün ≈ <b>{{ c.todayEquivalentLabel }}</b>
                    <span class="era-hint-anchor">(asgari ücret üzerinden kabaca)</span>
                  </div>
                </div>
              }

              <div class="wage-info">
                {{ mode() === 'dca' ? 'Her ay' : 'Tek seferinde' }}
                <b>{{ customAmountDisplay() }} {{ isOldEra() ? 'TL' : '₺' }}</b> yatırılacak.
                @if (wageInfoView(); as w) {
                  <span class="wage-ref">
                    · {{ w.year }} asgari ücreti: <b>{{ w.wageLabel }} {{ w.oldTlNote ? 'TL' : '₺' }}</b>
                    @if (w.oldTlNote) {
                      ({{ w.wageNewTlLabel }} ₺ Yeni TL karşılığı)
                    }
                  </span>
                }
              </div>
            </div>
          }
        </div>

        <!-- ── Aksiyon butonları ──────────────────────────── -->
        <div class="tm-actions">
          <button class="btn btn-main" type="button" (click)="calculate()" [disabled]="loading() || !canCalculate()">
            {{ loading() ? 'Hesaplanıyor…' : 'Hesapla' }}
          </button>
          <button class="btn btn-prem" type="button" [disabled]="!canSimulate()" (click)="runSim()">
            ✨ Simüle Et
          </button>
        </div>

        <!-- ── Sonuç ──────────────────────────────────────── -->
        @if (calc(); as r) {
          <div #tmResult class="tm-scroll-target">
          @if (r.error) {
            <div class="result show">
              <p class="headline err">{{ r.error }}</p>
            </div>
          } @else {
            <div class="result show">
              <p class="headline">
                <span class="big" [class.neg]="r.gainPct < 0">{{ formatInteger(r.currentValue) }} ₺</span> bugünkü değer —
                <span class="pct-badge" [class.neg]="r.gainPct < 0">
                  {{ r.gainPct >= 0 ? '+' : '' }}%{{ formatNumber(r.gainPct) }}
                </span>
              </p>

              @if (r.storyLines.length) {
                <div class="story">
                  @if (r.storyLines[0]; as first) {
                    <p class="story-line">{{ first }}</p>
                  }
                  <p class="story-line">
                    Bu da güncel olarak
                    <b class="story-tl" [class.neg]="r.gainPct < 0">{{ formatInteger(r.currentValue) }} ₺</b>
                    yapardı.
                  </p>
                  @for (line of r.storyLines; track $index; let i = $index) {
                    @if (i > 0) {
                      <p class="story-line">{{ line }}</p>
                    }
                  }
                </div>
              }

            </div>
          }
          </div>
        }

        <!-- ── Aynı gün X TL ile ne alsaydın? ─────────────────── -->
        @if (showAltPanel()) {
          <div class="alt-panel">
            <div class="alt-head">
              <span class="alt-title">🔀 {{ altPanelTitle() }}</span>
              <span class="alt-when">{{ altWhen() }}</span>
            </div>

            <div class="alt-body" [class.blurred]="mode() === 'dca'">
              @if (mode() === 'dca') {
                <button type="button" class="alt-lock-btn" (click)="scrollToModeSection()">
                  🔒 Sadece ALIM ŞEKLİ "Tek Seferlik" olanlarda gösterilmektedir
                </button>
              }

            <div class="parity-row">
              @for (p of parityChips(); track p.symbol) {
                <div
                  class="parity-chip"
                  [class.miss]="!p.leader"
                  [class.clickable]="!!p.leader"
                  (click)="p.leader && selectLeaderSymbol(p.symbol, 'bist')"
                >
                  <div class="chip-top">
                    <span class="chip-ico">{{ parityIcon(p.symbol) }}</span>
                    <b class="chip-name">{{ parityLabel(p.symbol) }}</b>
                    @if (p.leader; as row) {
                      <span class="chip-ret" [class.neg]="row.returnPct < 0">
                        {{ pctText(row.returnPct) }}
                      </span>
                    }
                  </div>
                  @if (p.leader; as row) {
                    <span class="chip-result mono" [class.neg]="row.returnPct < 0">
                      ~{{ formatMoneyAmount(grownFromReturn(row.returnPct)) }} ₺
                    </span>
                    <span class="chip-hist mono">
                      {{ formatMoneyAmount(row.startPrice) }} ₺ → {{ formatMoneyAmount(row.endPrice) }} ₺
                    </span>
                  } @else {
                    <span class="chip-sub">Bu tarihte veri yok</span>
                  }
                </div>
              }
            </div>

            <div class="seg alt-seg">
              <button type="button" [class.active]="altTab() === 'bist'" (click)="setAltTab('bist')">
                📈 Borsa İstanbul
              </button>
              <button type="button" [class.active]="altTab() === 'crypto'" (click)="setAltTab('crypto')">
                ₿ Kripto
              </button>
              <button type="button" [class.active]="altTab() === 'us'" (click)="setAltTab('us')">
                🇺🇸 ABD
              </button>
            </div>

            @if (altList().length) {
              <ol class="alt-list">
                @for (l of altList(); track l.symbol) {
                  <li
                    class="alt-item clickable"
                    [attr.data-rank]="l.rank"
                    (click)="selectLeaderSymbol(l.symbol, altTab())"
                  >
                    <span class="alt-rank">{{ l.rank }}</span>
                    <app-stock-logo
                      [symbol]="l.symbol"
                      [color]="symbolColor(l.symbol)"
                      [market]="altTab()"
                      size="sm"
                    />
                    <span class="alt-main">
                      <span class="alt-top">
                        <b>{{ altTitle(l) }}</b>
                        <span class="alt-ret" [class.neg]="l.returnPct < 0">{{ pctText(altAdjustedReturnPct(l.returnPct)) }}</span>
                      </span>
                      <span class="alt-hist mono">
                        {{ formatMoneyAmount(altAdjustedStartPrice(l)) }} {{ histCurrency() }} → {{ formatMoneyAmount(l.endPrice) }} {{ histCurrency() }}
                      </span>
                      @if (altTab() !== 'bist') {
                        <span class="alt-hist alt-hist-tl mono">
                          {{ formatMoneyAmount(altStartPriceTry(l)) }} ₺ → {{ formatMoneyAmount(l.endPrice * altUsdEnd()) }} ₺
                        </span>
                      }
                    </span>
                    <span class="alt-result mono" [class.neg]="l.returnPct < 0">
                      ~{{ formatMoneyAmount(grownFromReturn(altAdjustedReturnPct(l.returnPct))) }} ₺
                    </span>
                  </li>
                }
              </ol>
            } @else {
              <p class="alt-empty">{{ altEmptyText() }}</p>
            }
            </div>
          </div>
        }

        @if (showSim() && calc() && !calc()!.error) {
          <div #tmSim class="tm-scroll-target">
            <app-time-machine-simulation [calc]="calc()!" [runTrigger]="simTrigger()" />
          </div>
        }
      </div>
    </app-overlay>
  `,
  styleUrl: './time-machine-modal.component.css',
})
export class TimeMachineModalComponent {
  readonly modals = inject(ModalService);
  private readonly market = inject(MarketService);
  private readonly stockApi = inject(StockApiService);
  private readonly indexService = inject(IndexService);
  private readonly cryptoApi = inject(CryptoApiService);
  private readonly cryptoMarket = inject(CryptoMarketService);
  private readonly usMarket = inject(UsMarketService);
  private readonly usStockApi = inject(UsStockApiService);

  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;
  readonly formatMoneyAmount = formatMoneyAmount;
  readonly formatAssetPrice = formatAssetPrice;
  readonly formatLotRange = formatLotRange;
  readonly symbolColor = symbolColor;
  readonly isInstrumentMode = computed(
    () => isIndexSymbol(this.symbol()) || isForexSymbol(this.symbol()),
  );

  readonly symbol    = signal('THYAO');
  readonly mode      = signal<TimeMachineMode>('lump');
  /** Kaç asgari ücret (1-5×) — API'ye yüzde olarak gönderilir (bkz. calculate()). */
  readonly wageCount = signal(1);
  readonly investMode = signal<InvestMode>('wage');
  /** 0 = boş özel tutar (placeholder) */
  readonly customAmount = signal(0);
  readonly loading   = signal(false);
  readonly calc      = signal<TimeMachineCalc | null>(null);
  readonly showSim   = signal(false);
  readonly simTrigger = signal(0);

  private readonly resultEl = viewChild<ElementRef<HTMLElement>>('tmResult');
  private readonly simEl = viewChild<ElementRef<HTMLElement>>('tmSim');
  private readonly modeSectionEl = viewChild<ElementRef<HTMLElement>>('modeSection');

  /** Modal bu oturumda açık mı — her yeni açılışta formu sıfırlamak için */
  private tmWasOpen = false;

  // ── Seçili tarih — veri gelince earliest'e snap edilir
  dateStr = signal('');
  readonly todayStr = new Date().toISOString().slice(0, 10);

  // ── Erken tarih sınırı ───────────────────────────────
  private readonly cryptoEarliest = signal<string | null>(null);
  /** Liste API'sinde earliest yoksa detaydan doldurulur */
  private readonly bistEarliestOverride = signal<string | null>(null);
  private readonly usEarliestOverride = signal<string | null>(null);

  readonly isCryptoTm = computed(() => this.modals.timeMachineMarket() === 'crypto');
  readonly isUsTm = computed(() => this.modals.timeMachineMarket() === 'us');
  /** Sonuç/fiyat alanlarında $ mi ₺ mi gösterilecek — kripto ve ABD hisseleri USD. */
  readonly showsDollar = computed(() => this.isCryptoTm() || this.isUsTm());

  readonly minDateStr = computed<string>(() => {
    const sym = this.symbol();
    if (this.isCryptoTm()) {
      return (this.cryptoEarliest() ?? '').slice(0, 10);
    }
    if (this.isUsTm()) {
      const fromLive = this.usMarket.getEarliestDate(sym);
      if (fromLive) return fromLive.slice(0, 10);
      const override = this.usEarliestOverride();
      return override ? override.slice(0, 10) : '';
    }
    if (isIndexSymbol(sym) || isForexSymbol(sym)) {
      const q = this.indexService.quotes().find((q) => q.symbol === sym);
      if (q?.earliestDate) return q.earliestDate.slice(0, 10);
      return '';
    }
    const fromLive = this.market.getEarliestDate(sym);
    if (fromLive) return fromLive.slice(0, 10);
    const override = this.bistEarliestOverride();
    return override ? override.slice(0, 10) : '';
  });

  /** Takvim üstünde gösterilecek hint metni */
  readonly calendarHint = computed<string>(() => {
    const sym = this.symbol();
    const min = this.minDateStr();
    if (!min) return `${sym} için fiyat geçmişi yükleniyor…`;
    const d = new Date(min + 'T12:00:00');
    const label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${sym} için en erken başlangıç tarihi: ${label}`;
  });

  readonly dateLabel = computed(() => formatTurkishDate(this.dateStr()));
  readonly logoColor = computed(() => symbolColor(this.symbol()));

  /** Logo bileşeni için sembol (kripto: base asset) */
  readonly logoSymbol = computed(() => {
    const s = this.symbol();
    if (this.isCryptoTm()) {
      return s.endsWith('USDT') ? s.slice(0, -4) : s;
    }
    return s;
  });

  readonly symbolBadge = computed(() => {
    const s = this.symbol();
    if (this.isCryptoTm()) {
      const base = s.endsWith('USDT') ? s.slice(0, -4) : s;
      return base.slice(0, 3);
    }
    return s.slice(0, 2);
  });

  readonly pickerOpen = signal(false);
  readonly pickerQuery = signal('');
  readonly pickerIndex = signal(0);
  private readonly pickerSearch = viewChild<ElementRef<HTMLInputElement>>('pickerSearch');

  readonly selectedLabel = computed(() => {
    const s = this.symbol();
    if (this.isCryptoTm()) {
      const base = s.endsWith('USDT') ? s.slice(0, -4) : s;
      return `${base} / USDT`;
    }
    const fx = this.forexOptions().find((o) => o.symbol === s);
    return fx?.label ?? s;
  });

  private readonly forexOptions = computed(() =>
    this.indexService
      .quotes()
      .filter((q) => isForexSymbol(q.symbol))
      .map((q) => ({ symbol: q.symbol, label: q.displayName })),
  );

  private readonly allPickerOptions = computed<PickerOption[]>(() => {
    if (this.isCryptoTm()) {
      const all = Object.keys(this.cryptoMarket.priceMap()).sort((a, b) => a.localeCompare(b));
      const current = this.symbol();
      const list = current && !all.includes(current) ? [current, ...all] : all;
      return list.map((sym) => {
        const base = sym.endsWith('USDT') ? sym.slice(0, -4) : sym;
        return {
          value: sym,
          title: `${base} / USDT`,
          subtitle: sym,
          badge: base.slice(0, 3),
          color: symbolColor(sym),
        };
      });
    }

    if (this.isUsTm()) {
      const all = this.usMarket.symbolOptions();
      const current = this.symbol();
      const list = current && !all.includes(current) ? [current, ...all] : all;
      return list.map((sym) => ({
        value: sym,
        title: sym,
        badge: sym.slice(0, 2),
        color: symbolColor(sym),
      }));
    }

    const stocks = this.market.symbolOptions();
    const stockList = stocks.length ? [...stocks] : ['THYAO', 'GARAN', 'AKBNK'];
    const current = this.symbol();
    if (current && !stockList.includes(current) && !isForexSymbol(current)) {
      stockList.unshift(current);
    }

    const opts: PickerOption[] = [];
    for (const fx of this.forexOptions()) {
      opts.push({
        value: fx.symbol,
        title: fx.label,
        subtitle: fx.symbol,
        badge: fx.symbol.slice(0, 2),
        color: symbolColor(fx.symbol),
      });
    }
    for (const s of stockList) {
      opts.push({
        value: s,
        title: s,
        badge: s.slice(0, 2),
        color: symbolColor(s),
      });
    }
    return opts;
  });

  readonly pickerOptions = computed(() => {
    const q = this.pickerQuery().trim().toUpperCase();
    const all = this.allPickerOptions();
    if (!q) return all.slice(0, 80);
    return all
      .filter(
        (o) =>
          o.value.toUpperCase().includes(q) ||
          o.title.toUpperCase().includes(q) ||
          (o.subtitle?.toUpperCase().includes(q) ?? false),
      )
      .slice(0, 80);
  });

  readonly instrumentLabel = computed(() => {
    if (this.isCryptoTm()) return 'COİN SEÇ';
    if (this.isUsTm()) return 'ABD HİSSE SEÇ';
    return isForexSymbol(this.symbol()) ? 'DÖVİZ / ALTIN SEÇ' : 'HİSSE SEÇ';
  });

  readonly subtitle = computed(() => {
    if (this.isCryptoTm())
      return 'O tarihte belirlediğin USD tutarla bu coini alsaydın bugün ne olurdu?';
    if (this.isUsTm())
      return 'O tarihte belirlediğin tutarla bu ABD hissesini alsaydın bugün ne olurdu?';
    const sym = this.symbol();
    if (isForexSymbol(sym)) {
      const label = this.parityLabel(sym).toLocaleLowerCase('tr-TR');
      return `O tarihte belirlediğin tutarla ${label} alsaydın bugün ne olurdu?`;
    }
    return 'O tarihte belirlediğin tutarla bu hisseyi alsaydın bugün ne olurdu?';
  });

  readonly lotLabel = computed(() => {
    if (this.isCryptoTm()) return 'MİKTAR';
    switch (this.symbol()) {
      case 'USDTRY': return 'USD MİKTARI';
      case 'EURTRY': return 'EUR MİKTARI';
      case 'GRAMALTIN': return 'GRAM';
      default: return 'LOT';
    }
  });

  readonly wageInfoView = computed(() => {
    const iso = this.dateStr();
    if (!iso || iso.length < 7) return null;
    const year = +iso.slice(0, 4);
    const month = +iso.slice(5, 7);
    const wage = getMinimumWage(iso); // Yeni TL (2005 öncesi için 1.000.000'a bölünmüş kayıtlı)
    const inv = wage * this.wageCount();
    const totalMonths = (new Date().getFullYear() - year) * 12 - (month - 1);
    const fmt = (n: number) =>
      n >= 100 ? formatInteger(n) : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const lump = this.mode() === 'lump';
    // 2005 öncesi: gerçek (eski) nominal tutar öne çıkar, Yeni TL karşılığı parantezde ayrıca
    // gösterilir — proje sohbeti: "1993 asgari ücreti 1,56 ₺'ydi" demek yanıltıcı, o dönem
    // gerçekte "1.563.473 TL" yazıyordu.
    const isOld = iso < '2005-01-01';
    return {
      year,
      wageLabel: fmt(isOld ? wage * 1_000_000 : wage),
      wageNewTlLabel: isOld ? fmt(wage) : null,
      investLabel: fmt(isOld ? inv * 1_000_000 : inv),
      investNewTlLabel: isOld ? fmt(inv) : null,
      oldTlNote: isOld,
      modePrefix: lump ? 'tek seferde:' : 'her ay:',
      modeSuffix: lump ? '' : ` × ~${Math.max(totalMonths, 1)} ay`,
    };
  });

  /**
   * Özel tutar, SEÇİLEN TARİHİN parasıdır (bkz. resolveInvestAmountTry — tutar doğrudan o
   * tarihin fiyatına bölünür). Yakın tarihlerde bu sezgisel ("2016'da 1.000 ₺"), ama 2005
   * öncesinde redenominasyon + hiperenflasyon üst üste binince 1.000 ₺ = 1 milyar eski TL =
   * bugünün ~19 milyon ₺'si oluyor ve kullanıcı bunu girerken fark etmiyor. Bu yüzden yazdığı
   * tutarın bugünkü karşılığını canlı gösteriyoruz.
   *
   * Çıpa olarak asgari ücret kullanılıyor: repoda 1990'a kadar mevcut, ürünün diline uygun
   * ("kaç asgari ücret") ve gram altınla uyumlu — sapan tek çıpa dolar (1989 için ~10× fark).
   * SADECE bilgilendirme amaçlı; hesaba hiç girmiyor, dolayısıyla tartışmalı bir çıpa sonucu
   * etkilemiyor.
   */
  /**
   * 2005 öncesi tarihlerde girdi alanı ESKİ TL kabul eder — 1993'ü seçip "100.000 ₺" yazmak
   * anlamsız, çünkü yeni TL o tarihte yoktu ve 100.000 yeni TL = 100 milyar eski TL gibi
   * gerçek dışı bir tutara denk geliyordu. Kullanıcı o dönemin gerçek rakamlarıyla düşünsün
   * (asgari ücret 1.563.473 TL gibi). İçeride `customAmount` HER ZAMAN yeni TL tutulur
   * (÷ 1.000.000), böylece hesaplama ve API tarafı hiç değişmez.
   */
  readonly isOldEra = computed(() => {
    const iso = this.dateStr();
    return !!iso && iso.length >= 10 && iso < '2005-01-01';
  });

  /** İpucu metninde "2010 asgari ücreti …" derken kullanılan yıl. */
  readonly wageYearLabel = computed(() => {
    const iso = this.dateStr();
    return iso && iso.length >= 4 ? iso.slice(0, 4) : '';
  });

  readonly customAmountContext = computed(() => {
    const ctx = buildEraMoneyContext(this.dateStr(), this.customAmount());
    if (!ctx) return null;
    return {
      ...ctx,
      // Eski dönemde girdi zaten eski TL — burada yeni TL karşılığını gösteririz (tersi).
      newTlLabel: ctx.isOldEra
        ? this.customAmount().toLocaleString('tr-TR', { maximumFractionDigits: 4 })
        : null,
    };
  });

  /** Placeholder tarihi de söylesin — "Tutar girin" tek başına hangi dönemin parası olduğunu
   *  belirsiz bırakıyordu. */
  readonly customAmountPlaceholder = computed(() => {
    const iso = this.dateStr();
    if (!iso || iso.length < 10) return 'Tutar girin (₺)';
    const unit = this.isOldEra() ? 'TL — o günün lirası' : '₺';
    return `${formatTurkishDate(iso)} tarihinde yatıracağın tutar (${unit})`;
  });

  /** Özel tutara geçildiğinde alanı boş bırakmak yerine, bugünün 1.000 ₺'sinin o tarihteki
   *  karşılığıyla doldurmak için (1993 → ~0,05 ₺, 2016 → ~43 ₺). */
  private suggestedCustomAmount(): number {
    const iso = this.dateStr();
    if (!iso || iso.length < 7) return 0;
    const wageThen = getMinimumWage(iso);
    const wageNow = getMinimumWage(new Date().toISOString().slice(0, 10));
    if (wageThen <= 0 || wageNow <= 0) return 0;
    const raw = (1000 / wageNow) * wageThen;
    // Eski dönemde girdi eski TL gösterildiği için küçük yeni-TL değerleri sorun değil
    // (0,052116 ₺ → alanda "52.116 TL" olarak görünür). Modern dönemde alan tam sayı.
    if (this.isOldEra()) return Math.round(raw * 1_000_000) / 1_000_000;
    return Math.max(1, Math.round(raw));
  }

  readonly canSimulate = computed(
    () => !!this.calc() && !this.calc()!.error && this.calc()!.valueSeries.length > 0,
  );

  readonly canCalculate = computed(() => {
    const d = this.dateStr();
    if (!d || d.length < 10 || this.loading()) return false;
    if (this.investMode() === 'custom' && this.customAmount() <= 0) return false;
    return true;
  });

  /** Sembol değişince / açılışta en erken tarihe snap için */
  private dateSnapSymbol = '';

  // ── "Aynı gün X TL ile ne alsaydın?" ────────────────────
  readonly leaders = signal<TimeMachineLeaders | null>(null);
  readonly altTab = signal<'bist' | 'crypto' | 'us'>('bist');
  private leadersRequestedFor = '';

  /** Karşılaştırma paneli için tek seferlik tutar (DCA olsa bile). */
  readonly altInvestAmount = computed(() => {
    if (this.investMode() === 'custom') {
      return Math.max(0, this.customAmount());
    }
    const iso = this.dateStr();
    if (!iso || iso.length < 7) return 0;
    return getMinimumWage(iso) * this.wageCount();
  });

  /** Hesapla sonrası + geçerli tutar varken alternatif paneli göster. */
  readonly showAltPanel = computed(() => {
    const r = this.calc();
    if (!r || r.error) return false;
    if (this.altInvestAmount() <= 0) return false;
    return !!this.leaders();
  });

  readonly altPanelTitle = computed(() => {
    const amt = this.altInvestAmount();
    if (amt <= 0) return 'Aynı gün ne alsaydın?';
    return `Aynı gün ${formatMoneyAmount(amt)} ₺ ile ne alsaydın?`;
  });

  readonly parityChips = computed(() => {
    const lb = this.leaders();
    const bySym = new Map((lb?.parity ?? []).map((p) => [p.symbol, p] as const));
    return PARITY_SYMBOLS.map((symbol) => ({
      symbol,
      leader: bySym.get(symbol) ?? null,
    }));
  });

  readonly altList = computed<TimeMachineLeader[]>(() => {
    const lb = this.leaders();
    if (!lb) return [];
    if (this.altTab() === 'crypto') return lb.crypto;
    if (this.altTab() === 'us') return lb.usStocks;
    return lb.bist;
  });

  readonly altWhen = computed(() => {
    const row = this.altList()[0] ?? this.leaders()?.parity[0];
    if (!row) return '';
    return `${formatTurkishDate(row.startDate)} → ${formatTurkishDate(row.endDate)}`;
  });

  readonly altEmptyText = computed(() => {
    if (this.altTab() === 'crypto') return 'Bu tarihte henüz kripto verisi yok.';
    if (this.altTab() === 'us') return 'Bu tarihte ABD hisse verisi bulunamadı.';
    return 'Bu tarihte BIST verisi bulunamadı.';
  });

  constructor() {
    // Modal açılınca: her yeni açılışta formu sıfırla, sembolü ayarla
    effect(() => {
      const open = this.modals.active() === 'timeMachine';
      if (!open) {
        this.tmWasOpen = false;
        this.dateSnapSymbol = '';
        this.closePicker();
        return;
      }

      const tmMarket = this.modals.timeMachineMarket();
      const crypto = tmMarket === 'crypto';
      const us = tmMarket === 'us';
      const sym = this.modals.stockSymbol();
      const resolvedSym = sym ? (crypto || us ? sym : isIndexSymbol(sym) ? 'THYAO' : sym) : '';

      if (!this.tmWasOpen) {
        this.tmWasOpen = true;
        this.resetFormForOpen(tmMarket);

        // Dönem Şampiyonları kartından geldiyse o dönemin başlangıç tarihine sabitle —
        // aksi halde aşağıdaki "en erken tarihe snap" efekti bunu ezer (bkz. dateSnapSymbol eşleşmesi).
        const pendingDate = this.modals.timeMachineStartDate();
        if (pendingDate) {
          this.dateStr.set(pendingDate.slice(0, 10));
          this.dateSnapSymbol = resolvedSym;
          this.modals.timeMachineStartDate.set(null);
        }
      }

      if (sym) {
        this.symbol.set(resolvedSym);
      }
      if (!crypto && !us && !this.market.symbolOptions().length) this.market.loadMarket();
      if (!crypto && !us && !this.indexService.quotes().length) this.indexService.loadQuotes();
      if (crypto) {
        if (this.cryptoMarket.tickersCount() === 0) this.cryptoMarket.load();
        if (sym) {
          this.cryptoApi.getMeta(sym).subscribe({
            next: (m) => this.cryptoEarliest.set(m.earliestDataDate),
            error: () => this.cryptoEarliest.set(null),
          });
        }
      }
      if (us && !this.usMarket.symbolOptions().length) this.usMarket.loadMarket();
    });

    // Açılışta veya sembol değişince → o enstrümanın en erken tarihine snap.
    // Kullanıcı elle tarih seçtiyse (aynı sembolde) ezme.
    effect(() => {
      if (this.modals.active() !== 'timeMachine') return;
      const sym = this.symbol();
      const min = this.minDateStr();
      if (!min) return;

      const symbolChanged = sym !== this.dateSnapSymbol;
      const dateEmpty = !this.dateStr() || this.dateStr().length < 10;
      const belowMin = this.dateStr() < min;

      if (symbolChanged || dateEmpty || belowMin) {
        this.dateSnapSymbol = sym;
        this.dateStr.set(min);
      }
    });

    // Earliest bilinmiyorsa hisse detayından çek (GUNDG vb.)
    effect(() => {
      if (this.modals.active() !== 'timeMachine') return;
      if (this.isCryptoTm()) return;
      const sym = this.symbol();
      if (!sym || isIndexSymbol(sym) || isForexSymbol(sym)) return;

      if (this.isUsTm()) {
        if (this.usMarket.getEarliestDate(sym)) {
          this.usEarliestOverride.set(null);
          return;
        }
        this.usStockApi.getStock(sym).subscribe({
          next: (d) => {
            if (this.symbol() === sym) this.usEarliestOverride.set(d.earliestDataDate ?? null);
          },
          error: () => {
            if (this.symbol() === sym) this.usEarliestOverride.set(null);
          },
        });
        return;
      }

      if (this.market.getEarliestDate(sym)) {
        this.bistEarliestOverride.set(null);
        return;
      }
      this.stockApi.getStock(sym).subscribe({
        next: (d) => {
          const earliest = d.earliestDataDate ?? null;
          if (this.symbol() === sym) this.bistEarliestOverride.set(earliest);
        },
        error: () => {
          if (this.symbol() === sym) this.bistEarliestOverride.set(null);
        },
      });
    });
  }

  /** Her açılışta önceki girdi / sonucu temizle. Tarih min gelince effect doldurur. */
  private resetFormForOpen(tmMarket: 'bist' | 'crypto' | 'us'): void {
    this.mode.set('lump');
    this.wageCount.set(1);
    this.investMode.set('wage');
    this.customAmount.set(0);
    this.dateStr.set('');
    this.dateSnapSymbol = '';
    this.bistEarliestOverride.set(null);
    this.usEarliestOverride.set(null);
    this.resetCalc();
    this.leaders.set(null);
    this.leadersRequestedFor = '';
    this.altTab.set(tmMarket === 'crypto' ? 'crypto' : tmMarket === 'us' ? 'us' : 'bist');
    this.pickerQuery.set('');
    this.closePicker();
  }

  /** returnPct → bugünkü tutar (AdjustedClose oranı için multiple alanına güvenme). */
  grownFromReturn(returnPct: number): number {
    const amt = this.altInvestAmount();
    if (amt <= 0) return 0;
    return amt * (1 + returnPct / 100);
  }

  /**
   * Kripto/ABD liste satırlarındaki getiri USD (veya USDT) cinsinden — TL yatırımcısı için gerçek
   * getiriye kur farkını da eklemek gerekir (tek-hisse simülasyonundaki toTryCalc ile aynı mantık,
   * bkz. usdTryFromLeaders). BIST/parite zaten TL cinsinden, dokunulmaz.
   */
  altAdjustedReturnPct(returnPct: number): number {
    if (this.altTab() === 'bist') return returnPct;
    const usd = this.usdTryFromLeaders(this.leaders());
    if (!usd || usd.start <= 0) return returnPct;
    const usdFactor = usd.end / usd.start;
    return ((1 + returnPct / 100) * usdFactor - 1) * 100;
  }

  /**
   * l.startPrice ham (bölünmeler dahil değil) geçmiş fiyat — büyük getiri yüzdesiyle görsel olarak
   * çelişebiliyor (ör. MNST: ham ×13,5 ama gerçek/düzeltilmiş getiri ×2599, çünkü hisse çok bölündü).
   * Ham fiyat yerine, HER ZAMAN güvenilir olan bugünkü fiyattan (l.endPrice) geriye, l.returnPct
   * (zaten AdjustedClose bazlı) ile türetilen "bugünün fiyat biriminde o gün ne değerdeydi" rakamını
   * gösteriyoruz — TimeMachineCalculator'daki "bugünün alım gücüyle" mantığıyla birebir aynı.
   */
  altAdjustedStartPrice(l: TimeMachineLeader): number {
    const multiple = 1 + l.returnPct / 100;
    return multiple > 0 ? l.endPrice / multiple : l.startPrice;
  }

  /** Kripto/ABD satırlarında $ fiyatların yanına TL karşılığını da yazmak için — o günkü ve
   * bugünkü USD/TRY kuruyla çarpılır, böylece TL oranı üstteki rozet %'siyle birebir tutar
   * (kur farkı da dahil olduğu için). */
  altStartPriceTry(l: TimeMachineLeader): number {
    const usd = this.usdTryFromLeaders(this.leaders());
    return usd ? this.altAdjustedStartPrice(l) * usd.start : 0;
  }

  altUsdEnd(): number {
    return this.usdTryFromLeaders(this.leaders())?.end ?? 0;
  }

  returnMultiple(returnPct: number): number {
    return 1 + returnPct / 100;
  }

  setAltTab(tab: 'bist' | 'crypto' | 'us'): void {
    this.altTab.set(tab);
  }

  /** startPrice/endPrice ham fiyat — BIST native TL, kripto/ABD ise dolar cinsinden gelir. */
  histCurrency(): string {
    return this.altTab() === 'bist' ? '₺' : '$';
  }

  parityLabel(symbol: string): string {
    return PARITY_LABELS[symbol as ParitySymbol] ?? symbol;
  }

  parityIcon(symbol: string): string {
    return PARITY_ICONS[symbol as ParitySymbol] ?? '💱';
  }

  altTitle(leader: TimeMachineLeader): string {
    return leader.symbol.endsWith('USDT') ? leader.symbol.slice(0, -4) : leader.symbol;
  }

  altBadge(symbol: string): string {
    return this.altTitle({ symbol } as TimeMachineLeader).slice(0, 3);
  }

  /** Yüz binleri aşan getirilerde ondalık göstermek gürültü yaratıyor. */
  pctText(pct: number): string {
    const sign = pct >= 0 ? '+' : '';
    return Math.abs(pct) >= 1000
      ? `${sign}%${formatInteger(pct)}`
      : `${sign}%${formatNumber(pct)}`;
  }

  multipleText(multiple: number): string {
    if (multiple >= 1000) return `${formatInteger(multiple)}×`;
    return `${multiple.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}×`;
  }

  onClose(): void {
    this.closePicker();
    this.showSim.set(false);
    this.modals.close();
  }

  togglePicker(): void {
    if (this.pickerOpen()) {
      this.closePicker();
      return;
    }
    this.pickerOpen.set(true);
    this.pickerQuery.set('');
    this.pickerIndex.set(0);
    queueMicrotask(() => this.pickerSearch()?.nativeElement.focus());
  }

  closePicker(): void {
    this.pickerOpen.set(false);
    this.pickerQuery.set('');
    this.pickerIndex.set(0);
  }

  onPickerQuery(q: string): void {
    this.pickerQuery.set(q);
    this.pickerIndex.set(0);
  }

  onPickerNav(ev: Event, delta: number): void {
    ev.preventDefault();
    const n = this.pickerOptions().length;
    if (!n) return;
    this.pickerIndex.update((i) => (i + delta + n) % n);
  }

  onPickerEnter(ev: Event): void {
    ev.preventDefault();
    const list = this.pickerOptions();
    const pick = list[this.pickerIndex()] ?? list[0];
    if (pick) this.pickSymbol(pick.value);
  }

  pickSymbol(sym: string): void {
    this.closePicker();
    this.onSymbolChange(sym);
  }

  @HostListener('document:mousedown', ['$event'])
  onDocMouseDown(ev: MouseEvent): void {
    if (!this.pickerOpen()) return;
    const path = ev.composedPath?.() ?? [];
    const inside = path.some(
      (n) => n instanceof HTMLElement && n.classList.contains('sym-combo'),
    );
    if (!inside) this.closePicker();
  }

  /** "Aynı gün X ile ne alsaydın" panelindeki bir satıra/chip'e tıklanınca — o sembole ve piyasaya
   * geçip aynı tarih için sonucu doğrudan hesaplar, elle "Hisse Seç"e dönmeye gerek kalmaz. */
  selectLeaderSymbol(sym: string, targetMarket: 'bist' | 'crypto' | 'us'): void {
    this.modals.timeMachineMarket.set(targetMarket);
    this.onSymbolChange(sym);
    this.calculate();
  }

  onSymbolChange(sym: string): void {
    if (isIndexSymbol(sym)) return;
    this.symbol.set(sym);
    this.resetCalc();
    if (this.isCryptoTm()) {
      this.cryptoApi.getMeta(sym).subscribe({
        next: (m) => this.cryptoEarliest.set(m.earliestDataDate),
        error: () => this.cryptoEarliest.set(null),
      });
    }
  }

  onDateChange(iso: string): void {
    const eraChanged = this.isOldEra() !== (!!iso && iso.length >= 10 && iso < '2005-01-01');
    this.dateStr.set(iso);
    // Eski/yeni TL dönemleri arasında geçişte alan farklı bir birime döner; eldeki tutar
    // o birimde saçma bir rakama dönüşeceği için (ör. 52.116 eski TL → "0 ₺") yeniden önerilir.
    if (eraChanged && this.investMode() === 'custom' && this.customAmount() > 0) {
      this.customAmount.set(this.suggestedCustomAmount());
    }
    this.resetCalc();
  }

  onWageCountChange(val: number): void {
    this.wageCount.set(Math.min(5, Math.max(1, Math.round(+val))));
    this.resetCalc();
  }

  onCustomAmountChange(val: number): void {
    this.customAmount.set(+val || 0);
    this.resetCalc();
  }

  /** Yazarken 3 hanede bir otomatik nokta göstermek için — girilen metinden noktaları/harfleri
   * atıp saf sayıyı çıkarıyoruz, gösterim `customAmountDisplay` ile ayrıca formatlanıyor. */
  readonly customAmountDisplay = computed(() => {
    const v = this.customAmount();
    if (v <= 0) return '';
    // 2005 öncesinde kullanıcı eski TL görür/yazar; içeride yeni TL tutuluyor.
    return formatInteger(this.isOldEra() ? v * 1_000_000 : v);
  });

  onCustomAmountInput(raw: string): void {
    const digits = (raw || '').replace(/[^\d]/g, '');
    const typed = digits ? +digits : 0;
    this.customAmount.set(this.isOldEra() ? typed / 1_000_000 : typed);
    this.resetCalc();
  }

  setMode(m: TimeMachineMode): void {
    this.mode.set(m);
    this.resetCalc();
  }

  setInvestMode(m: InvestMode): void {
    this.investMode.set(m);
    // Özel tutara ilk geçişte alan boş kalıp "Hesapla"yı pasif bırakıyordu; seçili tarihe göre
    // makul bir başlangıç (bugünün 1.000 ₺'sinin o günkü karşılığı) yazılır — kullanıcı hiç
    // düşünmeden hesaplasa bile anlamlı bir sonuç görür.
    if (m === 'custom' && this.customAmount() <= 0) {
      this.customAmount.set(this.suggestedCustomAmount());
    }
    this.resetCalc();
  }

  resetCalc(): void {
    this.calc.set(null);
    this.showSim.set(false);
    this.simTrigger.set(0);
    this.leaders.set(null);
    this.leadersRequestedFor = '';
  }

  /** Asgari ücret veya özel tutar — her zaman TL. */
  private resolveInvestAmountTry(): number {
    if (this.investMode() === 'custom') return Math.max(0, this.customAmount());
    const iso = this.dateStr();
    if (!iso || iso.length < 7) return 0;
    return getMinimumWage(iso) * this.wageCount();
  }

  private usdTryFromLeaders(leaders: TimeMachineLeaders | null): { start: number; end: number } | null {
    const row = leaders?.parity?.find((p) => p.symbol === 'USDTRY');
    if (!row || row.startPrice <= 0 || row.endPrice <= 0) return null;
    return { start: row.startPrice, end: row.endPrice };
  }

  private toTryCalc(r: TimeMachineCalc, amountTry: number, usd: { start: number; end: number }): TimeMachineCalc {
    if (r.error) return r;
    // DCA: API toplam USD yatırımı döner → başlangıç kuruyla TL'ye çevir (yaklaşık)
    const invested =
      this.mode() === 'dca' && r.invested > 0 ? r.invested * usd.start : amountTry;
    const currentValue = r.currentValue * usd.end;
    const gainPct = invested > 0 ? ((currentValue / invested) - 1) * 100 : r.gainPct;
    return {
      ...r,
      invested,
      currentValue,
      gainPct,
      dividendsReceived: r.dividendsReceived * usd.end,
      dividendsReinvested: r.dividendsReinvested * usd.end,
      cashRemaining: r.cashRemaining * usd.end,
      valueSeries: (r.valueSeries ?? []).map((v) => v * usd.end),
    };
  }

  calculate(): void {
    if (!this.canCalculate()) return;

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
      this.scrollToAnchor('result');
      return;
    }

    this.loading.set(true);
    this.showSim.set(false);
    this.leaders.set(null);
    this.leadersRequestedFor = '';

    const iso = this.dateStr();
    const amountTry = this.resolveInvestAmountTry();
    const crypto = this.isCryptoTm();
    const us = this.isUsTm();

    const finishError = (msg: string) => {
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
        error: msg,
      });
      this.loading.set(false);
      this.scrollToAnchor('result');
    };

    const runInvestment = (leaders: TimeMachineLeaders | null) => {
      if (leaders && (leaders.bist.length || leaders.crypto.length || leaders.usStocks.length || leaders.parity.length)) {
        this.leaders.set(leaders);
        this.leadersRequestedFor = iso;
      }

      let amountForApi: number | undefined;
      let usd: { start: number; end: number } | null = null;

      if (crypto || us) {
        usd = this.usdTryFromLeaders(leaders);
        if (!usd) {
          finishError(
            us
              ? 'Bu tarih için USD/TRY paritesi yok; hesap TL’ye çevrilemedi.'
              : 'Bu tarih için USD/TRY paritesi yok; kripto hesabı TL’ye çevrilemedi.',
          );
          return;
        }
        if (amountTry <= 0) {
          finishError('Geçerli bir TL tutarı seç.');
          return;
        }
        amountForApi = amountTry / usd.start;
      } else if (this.investMode() === 'custom' && amountTry > 0) {
        amountForApi = amountTry;
      } else {
        amountForApi = undefined;
      }

      const usdSnapshot = usd;
      const result$ = us
        ? this.usStockApi.calculateTimeMachine(this.symbol(), iso, this.mode(), amountForApi!)
        : this.market.calculateInvestment(
            this.symbol(),
            iso,
            this.wageCount() * 100,
            this.mode(),
            amountForApi,
            crypto ? 'crypto' : 'bist',
          );

      result$.subscribe({
        next: (r) => {
          this.calc.set((crypto || us) && usdSnapshot ? this.toTryCalc(r, amountTry, usdSnapshot) : r);
          this.loading.set(false);
          this.scrollToAnchor('result');
        },
        error: () => finishError('Hesaplama başarısız. Backend bağlantısını kontrol et.'),
      });
    };

    this.market.getTimeMachineLeaders(iso).subscribe({
      next: (leaders) => runInvestment(leaders),
      error: () => {
        if (crypto || us) finishError('USD/TRY paritesi yüklenemedi.');
        else runInvestment(null);
      },
    });
  }

  runSim(): void {
    if (!this.canSimulate()) return;
    this.showSim.set(true);
    this.simTrigger.update((n) => n + 1);
    this.scrollToAnchor('sim');
  }

  /** "Aynı gün ne alsaydın" bulanıklaştırılmış kilit butonu — ALIM ŞEKLİ bölümüne kaydırır,
   * kullanıcı "Tek Seferlik"e geçmek isterse elle aramasın diye. */
  scrollToModeSection(): void {
    this.modeSectionEl()?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }

  /** Overlay scroll: sonuç / simülasyon bloğuna kaydır. */
  private scrollToAnchor(which: 'result' | 'sim'): void {
    // @if bloğu paint olduktan sonra scroll
    setTimeout(() => {
      const el =
        which === 'sim'
          ? this.simEl()?.nativeElement
          : this.resultEl()?.nativeElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }, 80);
  }
}
