import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CryptoMarketService } from '../../core/services/crypto-market.service';
import { MarketService } from '../../core/services/market.service';
import { UsMarketService } from '../../core/services/us-market.service';
import { ModalService } from '../../core/services/modal.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { formatInteger, formatNumber, symbolColor } from '../../core/utils/format.util';
import { isBistTradingOpen } from '../../core/utils/bist-trading-hours';
import { US_TRADING_ENABLED } from '../../core/utils/us-trading-hours';
import { StockLogoComponent } from '../../shared/components/stock-logo/stock-logo.component';
import {
  SymbolOption,
  SymbolSelectComponent,
} from '../../shared/components/symbol-select/symbol-select.component';

interface HoldingRow {
  symbol: string;
  marketType: 'bist' | 'crypto' | 'us';
  quantity: number;
  avgCost: number;
  price: number;
  value: number;
  pnl: number;
  pnlPct: number;
  color: string;
  currency: string;
}

@Component({
  selector: 'app-portfolio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DatePipe, StockLogoComponent, SymbolSelectComponent],
  template: `
    <section class="page">
      <a class="btn back-btn" routerLink="/">← Piyasa Ekranı</a>

      @if (!auth.isLoggedIn()) {
        <div class="pf-empty" style="margin-top: 24px">
          Portföyü görmek için giriş yap.
          <button class="btn btn-main" type="button" style="margin-top: 12px" (click)="modals.open('login')">
            Giriş Yap
          </button>
        </div>
      } @else {
        <div class="pf-hero">
          <div class="avatar">{{ avatar() }}</div>
          <div>
            <h2>{{ auth.currentUser()?.displayName }}</h2>
            <div class="sub">Sanal yatırımcı · 1.000.000 ₺
              @if (usdTryRate(); as rate) {
                <span class="fx-badge">USD/TRY {{ formatNumber(rate, 2) }}</span>
              }
            </div>
          </div>
          <div class="totals">
            <div class="total">
              <div class="k">TOPLAM VARLIK</div>
              <div class="v mono">{{ formatInteger(totalTry()) }} ₺</div>
            </div>
          </div>
        </div>

        <div class="stat-grid" style="margin-top: 14px">
          <div class="stat">
            <div class="k">NAKİT ₺</div>
            <div class="v mono">{{ formatInteger(portfolio.cash()) }} ₺</div>
          </div>
          <div class="stat">
            <div class="k">TOPLAM K/Z</div>
            <div class="v mono" [style.color]="pnlTry() >= 0 ? 'var(--up)' : 'var(--down)'">
              {{ pnlTry() >= 0 ? '+' : '' }}{{ formatInteger(pnlTry()) }} ₺
            </div>
          </div>
        </div>

        <!-- K/Z neye göre hesaplanıyor ve değerleme nasıl yapılıyor — bunlar ekrandaki
             sayılara bakarak anlaşılmıyordu. -->
        <div class="pf-note">
          <span>ℹ️</span>
          <span>
            Kâr/zarar, <b>1.000.000 ₺</b> başlangıç sermayesine göre hesaplanır.
            Kripto ve ABD varlıkları <b>anlık USD/TRY kuruyla</b> TL'ye çevrilir; BIST ve ABD
            hisseleri <b>son kapanış</b> fiyatından değerlenir. Bedelsiz, bedelli ve temettü
            gibi şirket işlemleri portföyüne <b>otomatik</b> yansıtılır.
          </span>
        </div>

        <div class="sec-h">
          HIZLI İŞLEM (BIST)
          <span class="sec-tag" [class.open]="bistOpen()" [class.closed]="!bistOpen()">
            {{ bistOpen() ? 'seans açık' : 'seans kapalı' }}
          </span>
        </div>
        @if (!bistOpen()) {
          <p class="sec-note">
            BIST işlemleri her gün <b>19:00 – ertesi sabah 09:30</b> arası açıktır; gün içinde
            fiyatlar henüz kesinleşmediği için emir alınmaz.
          </p>
        }
        <div class="trade">
          <app-symbol-select
            [(value)]="tradeSymbol"
            [options]="bistOptions()"
            market="bist"
            [disabled]="busy()"
          />
          <input
            class="f-input mono"
            type="number"
            min="1"
            step="1"
            [(ngModel)]="tradeLots"
            placeholder="Lot"
          />
          <button class="btn btn-buy" type="button" [disabled]="busy()" (click)="buy()">AL</button>
          <button class="btn btn-sell" type="button" [disabled]="busy()" (click)="sell()">SAT</button>
        </div>
        @if (tradeMsg()) {
          <div class="trade-msg" [style.color]="tradeMsgColor()">{{ tradeMsg() }}</div>
        }

        <div class="sec-h">
          HIZLI İŞLEM (KRİPTO)
          <span class="sec-tag open">7/24 açık</span>
        </div>
        <div class="trade">
          <app-symbol-select
            [(value)]="cryptoSymbol"
            [options]="cryptoOptions()"
            market="crypto"
            [disabled]="busyCrypto()"
          />
          <input
            class="f-input mono"
            type="number"
            min="0"
            step="any"
            [(ngModel)]="cryptoTry"
            placeholder="TL tutar"
          />
          <button class="btn btn-buy" type="button" [disabled]="busyCrypto()" (click)="buyCrypto()">AL</button>
          <button class="btn btn-sell" type="button" [disabled]="busyCrypto()" (click)="sellCrypto()">SAT</button>
        </div>
        @if (cryptoMsg()) {
          <div class="trade-msg" [style.color]="cryptoMsgColor()">{{ cryptoMsg() }}</div>
        }

        <div class="sec-h">
          HIZLI İŞLEM (ABD)
          <span class="sec-tag closed">kapalı</span>
        </div>
        <p class="sec-note">
          ABD hisselerinde alım-satım şimdilik kapalı — kurumsal işlem verisini tek kaynaktan
          aldığımız için bölünme ve birleşme gibi olaylar gözden kaçabiliyor. Bu piyasayı
          izleyebilir, Zaman Makinesi'nde geçmişe dönük deneyebilirsin.
        </p>
        <div class="trade">
          <app-symbol-select
            [(value)]="usSymbol"
            [options]="usOptions()"
            market="us"
            [disabled]="busyUs()"
          />
          <input
            class="f-input mono"
            type="number"
            min="0"
            step="any"
            [(ngModel)]="usTry"
            placeholder="TL tutar"
          />
          <button
            class="btn btn-buy"
            type="button"
            [disabled]="busyUs() || !usTradingOpen"
            title="ABD hisselerinde alım-satım şimdilik kapalı"
            (click)="buyUs()"
          >AL</button>
          <button
            class="btn btn-sell"
            type="button"
            [disabled]="busyUs() || !usTradingOpen"
            title="ABD hisselerinde alım-satım şimdilik kapalı"
            (click)="sellUs()"
          >SAT</button>
        </div>
        @if (usMsg()) {
          <div class="trade-msg" [style.color]="usMsgColor()">{{ usMsg() }}</div>
        }

        <div class="sec-h">VARLIKLARIM</div>

        <div class="hold-group bist">
          <div class="hold-head">
            <div class="hold-badge bist">BIST</div>
            <div class="hold-meta">
              <div class="hold-title">Borsa İstanbul</div>
              <div class="hold-sub">{{ bistHoldings().length }} pozisyon · {{ formatInteger(stockValueTry()) }} ₺</div>
            </div>
          </div>
          @if (!bistHoldings().length) {
            <div class="hold-empty">BIST pozisyonu yok.</div>
          } @else {
            <div class="hold-scroll">
              <table class="pf-table">
                <colgroup>
                  <col class="c-sym" />
                  <col class="c-qty" />
                  <col class="c-num" />
                  <col class="c-num" />
                  <col class="c-num" />
                  <col class="c-pnl" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Sembol</th>
                    <th class="r">Miktar</th>
                    <th class="r">Ort. Maliyet</th>
                    <th class="r">Güncel</th>
                    <th class="r">Değer</th>
                    <th class="r">K/Z</th>
                  </tr>
                </thead>
                <tbody>
                  @for (h of bistHoldings(); track h.symbol) {
                    <tr>
                      <td class="sym-cell">
                        <app-stock-logo [symbol]="h.symbol" [color]="h.color" market="bist" size="sm" />
                        <b>{{ h.symbol }}</b>
                      </td>
                      <td class="r mono num">{{ formatQty(h.quantity, 'bist') }}</td>
                      <td class="r mono num">{{ formatHoldingPrice(h.avgCost, 'bist') }} ₺</td>
                      <td class="r mono num">{{ formatHoldingPrice(h.price, 'bist') }} ₺</td>
                      <td class="r mono num">{{ formatHoldingPrice(h.value, 'bist') }} ₺</td>
                      <td class="r mono num" [style.color]="h.pnl >= 0 ? 'var(--up)' : 'var(--down)'">
                        {{ h.pnl >= 0 ? '+' : '' }}{{ formatInteger(h.pnl) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <div class="hold-group crypto">
          <div class="hold-head">
            <div class="hold-badge crypto">CRYPTO</div>
            <div class="hold-meta">
              <div class="hold-title">Kripto</div>
              <div class="hold-sub">{{ cryptoHoldings().length }} pozisyon · {{ formatNumber(stockValueUsd()) }} $</div>
            </div>
          </div>
          @if (!cryptoHoldings().length) {
            <div class="hold-empty">Kripto pozisyonu yok.</div>
          } @else {
            <div class="hold-scroll">
              <table class="pf-table">
                <colgroup>
                  <col class="c-sym" />
                  <col class="c-qty" />
                  <col class="c-num" />
                  <col class="c-num" />
                  <col class="c-num" />
                  <col class="c-pnl" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Sembol</th>
                    <th class="r">Miktar</th>
                    <th class="r">Ort. Maliyet</th>
                    <th class="r">Güncel</th>
                    <th class="r">Değer</th>
                    <th class="r">K/Z</th>
                  </tr>
                </thead>
                <tbody>
                  @for (h of cryptoHoldings(); track h.symbol) {
                    <tr>
                      <td class="sym-cell">
                        <app-stock-logo [symbol]="h.symbol" [color]="h.color" market="crypto" size="sm" />
                        <b>{{ displaySymbol(h.symbol, 'crypto') }}</b>
                      </td>
                      <td class="r mono num">{{ formatQty(h.quantity, 'crypto') }}</td>
                      <td class="r mono num">{{ formatHoldingPrice(h.avgCost, 'crypto') }} $</td>
                      <td class="r mono num">{{ formatHoldingPrice(h.price, 'crypto') }} $</td>
                      <td class="r mono num">{{ formatHoldingPrice(h.value, 'crypto') }} $</td>
                      <td class="r mono num" [style.color]="h.pnl >= 0 ? 'var(--up)' : 'var(--down)'">
                        {{ h.pnl >= 0 ? '+' : '' }}{{ formatNumber(h.pnl) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <div class="hold-group us">
          <div class="hold-head">
            <div class="hold-badge us">ABD</div>
            <div class="hold-meta">
              <div class="hold-title">ABD Hisseleri</div>
              <div class="hold-sub">{{ usHoldings().length }} pozisyon · {{ formatNumber(stockValueUs()) }} $</div>
            </div>
          </div>
          @if (!usHoldings().length) {
            <div class="hold-empty">ABD hisse pozisyonu yok.</div>
          } @else {
            <div class="hold-scroll">
              <table class="pf-table">
                <colgroup>
                  <col class="c-sym" />
                  <col class="c-qty" />
                  <col class="c-num" />
                  <col class="c-num" />
                  <col class="c-num" />
                  <col class="c-pnl" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Sembol</th>
                    <th class="r">Miktar</th>
                    <th class="r">Ort. Maliyet</th>
                    <th class="r">Güncel</th>
                    <th class="r">Değer</th>
                    <th class="r">K/Z</th>
                  </tr>
                </thead>
                <tbody>
                  @for (h of usHoldings(); track h.symbol) {
                    <tr>
                      <td class="sym-cell">
                        <app-stock-logo [symbol]="h.symbol" [color]="h.color" market="us" size="sm" />
                        <b>{{ h.symbol }}</b>
                      </td>
                      <td class="r mono num">{{ formatQty(h.quantity, 'us') }}</td>
                      <td class="r mono num">{{ formatHoldingPrice(h.avgCost, 'us') }} $</td>
                      <td class="r mono num">{{ formatHoldingPrice(h.price, 'us') }} $</td>
                      <td class="r mono num">{{ formatHoldingPrice(h.value, 'us') }} $</td>
                      <td class="r mono num" [style.color]="h.pnl >= 0 ? 'var(--up)' : 'var(--down)'">
                        {{ h.pnl >= 0 ? '+' : '' }}{{ formatNumber(h.pnl) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <div class="sec-h">📜 İŞLEM GEÇMİŞİM</div>
        <div class="privacy-box">
          <label class="privacy-row">
            <input
              type="checkbox"
              [ngModel]="privacyDraft()"
              (ngModelChange)="privacyDraft.set($event)"
            />
            <span>
              İşlem geçmişim liderlikte başkalarına görünsün
              <small>Varsayılan açık. Kapatırsan detaylar kilitli görünür.</small>
            </span>
          </label>
          <button
            class="btn btn-save"
            type="button"
            [disabled]="privacySaving() || !privacyDirty()"
            (click)="savePrivacy()"
          >
            @if (privacySaving()) { Kaydediliyor… } @else { Kaydet }
          </button>
          @if (privacyMsg()) {
            <div class="privacy-msg" [class.ok]="privacyMsgOk()">{{ privacyMsg() }}</div>
          }
        </div>
        @if (portfolio.transactionsLoading()) {
          <div class="hold-empty">Yükleniyor…</div>
        } @else if (!portfolio.transactions().length) {
          <div class="hold-empty">Henüz işlem yok.</div>
        } @else {
          @for (tx of portfolio.transactions(); track tx.id) {
            <div class="tx">
              <span class="side" [class.al]="tx.side === 'buy'" [class.sat]="tx.side === 'sell'">
                {{ tx.side === 'buy' ? 'AL' : 'SAT' }}
              </span>
              <app-stock-logo
                [symbol]="tx.symbol"
                [color]="symbolColor(tx.symbol)"
                [market]="tx.marketType"
                size="sm"
              />
              <b>{{ displaySymbol(tx.symbol, tx.marketType) }}</b>
              <span class="mono">
                {{ formatQty(tx.quantity, tx.marketType) }}
                · {{ formatHoldingPrice(tx.price, tx.marketType) }}
                {{ tx.marketType === 'bist' ? '₺' : '$' }}
              </span>
              <span class="tag">{{ txTag(tx.marketType) }}</span>
              <span class="when">{{ tx.at | date: 'dd.MM.yyyy HH:mm' }}</span>
            </div>
          }

          @if (portfolio.transactionsTotalPages() > 1) {
            <div class="pager">
              <button
                class="btn pager-btn"
                type="button"
                [disabled]="portfolio.transactionsPage() <= 1 || portfolio.transactionsLoading()"
                (click)="goTxPage(portfolio.transactionsPage() - 1)"
              >
                ← Önceki
              </button>
              <span class="pager-meta mono">
                Sayfa {{ portfolio.transactionsPage() }} / {{ portfolio.transactionsTotalPages() }}
                · {{ portfolio.transactionsTotalCount() }} işlem
              </span>
              <button
                class="btn pager-btn"
                type="button"
                [disabled]="portfolio.transactionsPage() >= portfolio.transactionsTotalPages() || portfolio.transactionsLoading()"
                (click)="goTxPage(portfolio.transactionsPage() + 1)"
              >
                Sonraki →
              </button>
            </div>
          } @else if (portfolio.transactionsTotalCount() > 0) {
            <div class="pager-meta mono" style="margin-top: 10px; color: var(--muted); font-size: 12px">
              {{ portfolio.transactionsTotalCount() }} işlem
            </div>
          }
        }
      }
    </section>
  `,
  styleUrl: './portfolio.page.css',
})
export class PortfolioPageComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly portfolio = inject(PortfolioService);
  readonly modals = inject(ModalService);
  private readonly market = inject(MarketService);
  private readonly crypto = inject(CryptoMarketService);
  private readonly us = inject(UsMarketService);

  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;
  readonly symbolColor = symbolColor;

  tradeSymbol = 'THYAO';
  tradeLots = 10;
  readonly tradeMsg = signal('');
  readonly busy = signal(false);

  cryptoSymbol = 'BTCUSDT';
  cryptoTry = 1000;
  readonly cryptoMsg = signal('');
  readonly busyCrypto = signal(false);

  usSymbol = 'AAPL';
  usTry = 1000;
  readonly usMsg = signal('');
  readonly busyUs = signal(false);

  readonly usdTryRate = computed(() => this.crypto.usdTryRate());

  readonly privacyDraft = signal(true);
  readonly privacySaving = signal(false);
  readonly privacyMsg = signal('');
  readonly privacyMsgOk = signal(false);

  readonly privacyDirty = computed(() => {
    const saved = this.auth.currentUser()?.showTradeHistoryPublic !== false;
    return this.privacyDraft() !== saved;
  });

  readonly bistOptions = computed<SymbolOption[]>(() => {
    const fromMarket = this.market.symbolOptions();
    const fromHoldings = this.portfolio
      .portfolio()
      .holdings.filter((h) => h.marketType === 'bist')
      .map((h) => h.symbol);
    const symbols = [...new Set([...fromHoldings, ...fromMarket, 'THYAO', 'GARAN'])].sort();
    return symbols.map((s) => ({ value: s, title: s, subtitle: 'BIST' }));
  });

  readonly cryptoOptions = computed<SymbolOption[]>(() => {
    const fromMarket = this.crypto.filtered().map((t) => t.symbol);
    const fromHoldings = this.portfolio
      .portfolio()
      .holdings.filter((h) => h.marketType === 'crypto')
      .map((h) => h.symbol);
    const symbols = [...new Set([...fromHoldings, ...fromMarket, 'BTCUSDT', 'ETHUSDT'])];
    return symbols.map((s) => {
      const base = s.endsWith('USDT') ? s.slice(0, -4) : s;
      return { value: s, title: base, subtitle: `${base}/USDT` };
    });
  });

  readonly usOptions = computed<SymbolOption[]>(() => {
    const fromMarket = this.us.symbolOptions();
    const fromHoldings = this.portfolio
      .portfolio()
      .holdings.filter((h) => h.marketType === 'us')
      .map((h) => h.symbol);
    const symbols = [...new Set([...fromHoldings, ...fromMarket, 'AAPL', 'MSFT'])].sort();
    return symbols.map((s) => ({ value: s, title: s, subtitle: 'ABD' }));
  });

  readonly holdings = computed<HoldingRow[]>(() => {
    this.market.page();
    this.crypto.cards();
    this.us.cards();
    return this.portfolio.portfolio().holdings.map((h) => {
      const price =
        h.marketType === 'crypto'
          ? this.crypto.getPrice(h.symbol) || h.avgCost
          : h.marketType === 'us'
            ? this.us.getCard(h.symbol)?.close || h.avgCost
            : this.market.getPrice(h.symbol) || h.avgCost;
      const value = price * h.quantity;
      const cost = h.avgCost * h.quantity;
      return {
        symbol: h.symbol,
        marketType: h.marketType,
        quantity: h.quantity,
        avgCost: h.avgCost,
        price,
        value,
        pnl: value - cost,
        pnlPct: cost ? ((value - cost) / cost) * 100 : 0,
        color: symbolColor(h.symbol),
        currency: h.marketType === 'bist' ? '₺' : '$',
      };
    });
  });

  readonly bistHoldings = computed(() =>
    this.holdings()
      .filter((h) => h.marketType === 'bist')
      .slice()
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
  );
  readonly cryptoHoldings = computed(() =>
    this.holdings()
      .filter((h) => h.marketType === 'crypto')
      .slice()
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
  );
  readonly usHoldings = computed(() =>
    this.holdings()
      .filter((h) => h.marketType === 'us')
      .slice()
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
  );

  readonly stockValueTry = computed(() => this.bistHoldings().reduce((s, h) => s + h.value, 0));
  readonly stockValueUsd = computed(() => this.cryptoHoldings().reduce((s, h) => s + h.value, 0));
  readonly stockValueUs = computed(() => this.usHoldings().reduce((s, h) => s + h.value, 0));

  /** Tek TL havuzu: BIST zaten TL, kripto/ABD değeri anlık kurla TL'ye çevrilir. */
  readonly totalTry = computed(() => {
    const rate = this.usdTryRate() ?? 0;
    return (
      this.stockValueTry() +
      (this.stockValueUsd() + this.stockValueUs()) * rate +
      this.portfolio.cash()
    );
  });
  readonly pnlTry = computed(() => this.totalTry() - 1_000_000);

  /** Bölüm başlığındaki seans rozetini besler; dakikada bir tazelenir. */
  private readonly clockTick = signal(0);
  readonly bistOpen = computed(() => {
    this.clockTick();
    return isBistTradingOpen();
  });

  /** ABD alım-satımı ürün kararıyla kapalı (bkz. us-trading-hours.ts). */
  readonly usTradingOpen = US_TRADING_ENABLED;

  private readonly statusTimer = setInterval(() => this.clockTick.update((n) => n + 1), 60_000);

  ngOnDestroy(): void {
    clearInterval(this.statusTimer);
  }

  ngOnInit(): void {
    void this.portfolio.reload();
    this.market.loadMarket();
    this.crypto.load();
    this.us.loadMarket();
    this.privacyDraft.set(this.auth.currentUser()?.showTradeHistoryPublic !== false);
  }

  goTxPage(page: number): void {
    void this.portfolio.loadTransactions(page);
  }

  async savePrivacy(): Promise<void> {
    this.privacySaving.set(true);
    this.privacyMsg.set('');
    try {
      await this.auth.updateTradeHistoryPrivacy(this.privacyDraft());
      this.privacyMsgOk.set(true);
      this.privacyMsg.set('Gizlilik ayarı kaydedildi.');
    } catch (e: any) {
      this.privacyMsgOk.set(false);
      this.privacyMsg.set(e?.message || 'Kaydedilemedi.');
    } finally {
      this.privacySaving.set(false);
    }
  }

  avatar(): string {
    const name = this.auth.currentUser()?.displayName ?? '?';
    return name.slice(0, 1).toUpperCase();
  }

  displaySymbol(symbol: string, market: 'bist' | 'crypto' | 'us'): string {
    if (market === 'crypto' && symbol.endsWith('USDT')) return symbol.slice(0, -4);
    return symbol;
  }

  tradeMsgColor(): string {
    return this.tradeMsg().includes('✓') ? 'var(--up)' : 'var(--down)';
  }

  cryptoMsgColor(): string {
    return this.cryptoMsg().includes('✓') ? 'var(--up)' : 'var(--down)';
  }

  formatQty(q: number, market: 'bist' | 'crypto' | 'us'): string {
    if (market === 'bist') return String(Math.round(q));
    // Sabit basamak → fiyat tick'inde kolon genişliği oynamasın
    if (q >= 100) return q.toFixed(2);
    if (q >= 1) return q.toFixed(4);
    return q.toFixed(6);
  }

  formatHoldingPrice(v: number, market: 'bist' | 'crypto' | 'us'): string {
    if (market === 'bist') return formatNumber(v, 2);
    // Sabit 2–4 hane: tick'te string uzunluğu zıplamasın
    const abs = Math.abs(v);
    if (abs >= 100) return formatNumber(v, 2);
    if (abs >= 1) return formatNumber(v, 4);
    return formatNumber(v, 6);
  }

  async buy(): Promise<void> {
    this.busy.set(true);
    const err = await this.portfolio.buy(this.tradeSymbol, this.tradeLots);
    if (err === '__bist_closed__') this.tradeMsg.set('');
    else this.tradeMsg.set(err ?? `✓ ${this.tradeLots} lot ${this.tradeSymbol} alındı.`);
    this.busy.set(false);
  }

  async sell(): Promise<void> {
    this.busy.set(true);
    const err = await this.portfolio.sell(this.tradeSymbol, this.tradeLots);
    if (err === '__bist_closed__') this.tradeMsg.set('');
    else this.tradeMsg.set(err ?? `✓ ${this.tradeLots} lot ${this.tradeSymbol} satıldı.`);
    this.busy.set(false);
  }

  async buyCrypto(): Promise<void> {
    const tl = Number(this.cryptoTry);
    if (!Number.isFinite(tl) || tl <= 0) {
      this.cryptoMsg.set('Geçerli bir TL tutarı gir.');
      return;
    }
    this.busyCrypto.set(true);
    const res = await this.portfolio.buyCrypto(this.cryptoSymbol, { tryAmount: tl });
    this.cryptoMsg.set(
      res.error ?? `✓ ${formatNumber(tl)} ₺ ile ${this.displaySymbol(this.cryptoSymbol, 'crypto')} alındı.`,
    );
    this.busyCrypto.set(false);
  }

  async sellCrypto(): Promise<void> {
    const tl = Number(this.cryptoTry);
    if (!Number.isFinite(tl) || tl <= 0) {
      this.cryptoMsg.set('Geçerli bir TL tutarı gir.');
      return;
    }
    const price = this.crypto.getPrice(this.cryptoSymbol);
    const rate = this.usdTryRate();
    if (!price || price <= 0 || !rate) {
      this.cryptoMsg.set('Fiyat veya kur bulunamadı.');
      return;
    }
    const qty = tl / rate / price;
    this.busyCrypto.set(true);
    const res = await this.portfolio.sellCrypto(this.cryptoSymbol, qty);
    this.cryptoMsg.set(
      res.error ?? `✓ ${formatNumber(tl)} ₺ değerinde ${this.displaySymbol(this.cryptoSymbol, 'crypto')} satıldı.`,
    );
    this.busyCrypto.set(false);
  }

  usMsgColor(): string {
    return this.usMsg().includes('✓') ? 'var(--up)' : 'var(--down)';
  }

  txTag(market: 'bist' | 'crypto' | 'us'): string {
    if (market === 'crypto') return 'CRYPTO';
    if (market === 'us') return 'ABD';
    return 'BIST';
  }

  async buyUs(): Promise<void> {
    const tl = Number(this.usTry);
    if (!Number.isFinite(tl) || tl <= 0) {
      this.usMsg.set('Geçerli bir TL tutarı gir.');
      return;
    }
    this.busyUs.set(true);
    const err = await this.portfolio.buyUs(this.usSymbol, tl);
    if (err === '__us_closed__') this.usMsg.set('');
    else this.usMsg.set(err ?? `✓ ${formatNumber(tl)} ₺ ile ${this.usSymbol} alındı.`);
    this.busyUs.set(false);
  }

  async sellUs(): Promise<void> {
    const tl = Number(this.usTry);
    const price = this.us.getCard(this.usSymbol)?.close;
    const rate = this.usdTryRate();
    if (!Number.isFinite(tl) || tl <= 0 || !price || !rate) {
      this.usMsg.set('Geçerli bir TL tutarı gir (fiyat/kur henüz yüklenmemiş olabilir).');
      return;
    }
    const qty = tl / rate / price;
    this.busyUs.set(true);
    const err = await this.portfolio.sellUs(this.usSymbol, qty);
    if (err === '__us_closed__') this.usMsg.set('');
    else this.usMsg.set(err ?? `✓ ${formatNumber(tl)} ₺ değerinde ${this.usSymbol} satıldı.`);
    this.busyUs.set(false);
  }
}
