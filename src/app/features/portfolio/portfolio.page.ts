import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CryptoMarketService } from '../../core/services/crypto-market.service';
import { MarketService } from '../../core/services/market.service';
import { ModalService } from '../../core/services/modal.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { formatInteger, formatNumber, symbolColor } from '../../core/utils/format.util';
import { StockLogoComponent } from '../../shared/components/stock-logo/stock-logo.component';
import {
  SymbolOption,
  SymbolSelectComponent,
} from '../../shared/components/symbol-select/symbol-select.component';

interface HoldingRow {
  symbol: string;
  marketType: 'bist' | 'crypto';
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
            <div class="sub">Sanal yatırımcı · 1.000.000 ₺ + 100.000 $</div>
          </div>
          <div class="totals">
            <div class="total">
              <div class="k">BIST VARLIK</div>
              <div class="v mono">{{ formatInteger(totalTry()) }} ₺</div>
            </div>
            <div class="total">
              <div class="k">KRİPTO VARLIK</div>
              <div class="v mono">{{ formatNumber(totalUsd()) }} $</div>
            </div>
          </div>
        </div>

        <div class="stat-grid" style="margin-top: 14px">
          <div class="stat">
            <div class="k">NAKİT ₺</div>
            <div class="v mono">{{ formatInteger(portfolio.cashTry()) }} ₺</div>
          </div>
          <div class="stat">
            <div class="k">NAKİT $</div>
            <div class="v mono">{{ formatNumber(portfolio.cashUsd()) }} $</div>
          </div>
          <div class="stat">
            <div class="k">BIST K/Z</div>
            <div class="v mono" [style.color]="pnlTry() >= 0 ? 'var(--up)' : 'var(--down)'">
              {{ pnlTry() >= 0 ? '+' : '' }}{{ formatInteger(pnlTry()) }} ₺
            </div>
          </div>
          <div class="stat">
            <div class="k">KRİPTO K/Z</div>
            <div class="v mono" [style.color]="pnlUsd() >= 0 ? 'var(--up)' : 'var(--down)'">
              {{ pnlUsd() >= 0 ? '+' : '' }}{{ formatNumber(pnlUsd()) }} $
            </div>
          </div>
        </div>

        <div class="sec-h">HIZLI İŞLEM (BIST)</div>
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

        <div class="sec-h">HIZLI İŞLEM (KRİPTO)</div>
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
            [(ngModel)]="cryptoUsd"
            placeholder="USD tutar"
          />
          <button class="btn btn-buy" type="button" [disabled]="busyCrypto()" (click)="buyCrypto()">AL</button>
          <button class="btn btn-sell" type="button" [disabled]="busyCrypto()" (click)="sellCrypto()">SAT</button>
        </div>
        @if (cryptoMsg()) {
          <div class="trade-msg" [style.color]="cryptoMsgColor()">{{ cryptoMsg() }}</div>
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
                {{ tx.marketType === 'crypto' ? '$' : '₺' }}
              </span>
              <span class="tag">{{ tx.marketType === 'crypto' ? 'CRYPTO' : 'BIST' }}</span>
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
  styles: `
    .pf-hero {
      display: flex; align-items: center; gap: 18px; margin-top: 24px;
      background: linear-gradient(135deg, var(--panel), var(--panel-grad-end));
      border: 1px solid var(--line); border-radius: 20px; padding: 24px; flex-wrap: wrap;
    }
    .avatar {
      width: 74px; height: 74px; border-radius: 20px;
      background: linear-gradient(135deg, #22c98a, #0e7a55);
      display: flex; align-items: center; justify-content: center;
      font-size: 32px; font-weight: 800; color: #04180f;
    }
    .pf-hero h2 { font-size: 24px; }
    .totals { margin-left: auto; display: flex; gap: 24px; flex-wrap: wrap; }
    .total {
      text-align: right;
      .k { font-size: 11px; color: var(--muted); font-weight: 700; letter-spacing: 0.5px; }
      .v { font-size: 26px; font-weight: 800; }
    }
    .trade {
      display: flex; gap: 9px; flex-wrap: wrap; align-items: center;
      app-symbol-select { flex: 2; min-width: 200px; }
      input { flex: 1; min-width: 100px; }
    }
    .trade-msg { margin-top: 9px; font-size: 12.5px; min-height: 18px; font-weight: 600; }

    .hold-group {
      margin-top: 12px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: var(--panel);
      overflow: hidden;
    }
    .hold-group.bist {
      background:
        linear-gradient(135deg, color-mix(in srgb, #0e7a55 8%, var(--panel)), var(--panel) 42%);
      border-color: color-mix(in srgb, #0e7a55 28%, var(--line));
    }
    .hold-group.crypto {
      margin-top: 14px;
      background:
        linear-gradient(135deg, color-mix(in srgb, #3b82f6 9%, var(--panel)), var(--panel) 42%);
      border-color: color-mix(in srgb, #3b82f6 28%, var(--line));
    }
    .hold-head {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px 12px;
      border-bottom: 1px solid var(--line);
    }
    .hold-badge {
      font-size: 11px; font-weight: 800; letter-spacing: 0.6px;
      padding: 7px 10px; border-radius: 999px; color: #fff;
    }
    .hold-badge.bist { background: linear-gradient(135deg, #16a34a, #0e7a55); }
    .hold-badge.crypto { background: linear-gradient(135deg, #60a5fa, #2563eb); }
    .hold-title { font-size: 15px; font-weight: 800; line-height: 1.2; }
    .hold-sub { font-size: 12px; color: var(--muted); font-weight: 600; margin-top: 2px; }
    .hold-empty {
      padding: 18px 16px; color: var(--muted); font-size: 13px; font-weight: 600;
    }
    .hold-scroll { overflow-x: auto; }

    .pf-table {
      width: 100%;
      min-width: 640px;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 12.5px;
      .c-sym { width: 22%; }
      .c-qty { width: 14%; }
      .c-num { width: 16%; }
      .c-pnl { width: 16%; }
      th {
        text-align: left; color: var(--muted); font-size: 10.5px;
        letter-spacing: 0.5px; padding: 8px 10px; border-bottom: 1px solid var(--line);
        white-space: nowrap;
      }
      td {
        padding: 0 10px;
        height: 52px;
        border-bottom: 1px solid var(--line);
        vertical-align: middle;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      tbody tr:last-child td { border-bottom: 0; }
      .r { text-align: right; }
      .num {
        font-variant-numeric: tabular-nums;
        font-feature-settings: 'tnum' 1;
      }
      .sym-cell {
        display: flex; align-items: center; gap: 8px;
        min-width: 0;
        b { overflow: hidden; text-overflow: ellipsis; }
      }
    }
    .pf-empty {
      margin-top: 12px; padding: 20px; text-align: center; color: var(--muted);
      font-size: 13px; background: var(--panel2); border: 1px dashed var(--line); border-radius: 12px;
    }
    .tx {
      display: flex; align-items: center; gap: 12px; padding: 11px 13px;
      background: var(--panel2); border: 1px solid var(--line); border-radius: 11px;
      margin-bottom: 7px; font-size: 12.5px;
      .side {
        font-weight: 800; font-size: 11px; padding: 4px 9px; border-radius: 7px; letter-spacing: 0.5px;
        &.al { background: var(--up-bg); color: var(--up); }
        &.sat { background: var(--down-bg); color: var(--down); }
      }
      .tag { font-size: 10px; color: var(--muted); font-weight: 700; }
      .when { margin-left: auto; color: var(--muted); font-size: 11px; white-space: nowrap; }
    }
    .pager {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      margin-top: 12px; flex-wrap: wrap;
    }
    .pager-btn {
      background: var(--panel2); border: 1px solid var(--line);
      color: var(--text); border-radius: 10px; padding: 8px 12px;
      font-size: 12.5px; font-weight: 700; cursor: pointer;
    }
    .pager-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .pager-meta {
      font-size: 12px; font-weight: 600; color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .privacy-box {
      display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
      margin: 0 0 14px;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--panel2);
    }
    .privacy-row {
      flex: 1; min-width: 220px;
      display: flex; gap: 10px; align-items: flex-start;
      cursor: pointer; font-size: 13.5px; font-weight: 700;
      input { margin-top: 3px; width: 16px; height: 16px; accent-color: var(--up); }
      small {
        display: block; margin-top: 3px;
        font-size: 11.5px; font-weight: 500; color: var(--muted); line-height: 1.35;
      }
    }
    .btn-save {
      background: var(--text); color: var(--panel);
      border: none; border-radius: 10px; padding: 9px 14px;
      font-size: 12.5px; font-weight: 700; cursor: pointer;
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }
    .privacy-msg { width: 100%; font-size: 12.5px; font-weight: 600; color: var(--down); }
    .privacy-msg.ok { color: var(--up); }
    @media (max-width: 600px) {
      .totals { margin-left: 0; width: 100%; }
      .total { text-align: left; }
    }
  `,
})
export class PortfolioPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly portfolio = inject(PortfolioService);
  readonly modals = inject(ModalService);
  private readonly market = inject(MarketService);
  private readonly crypto = inject(CryptoMarketService);

  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;
  readonly symbolColor = symbolColor;

  tradeSymbol = 'THYAO';
  tradeLots = 10;
  readonly tradeMsg = signal('');
  readonly busy = signal(false);

  cryptoSymbol = 'BTCUSDT';
  cryptoUsd = 100;
  readonly cryptoMsg = signal('');
  readonly busyCrypto = signal(false);

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

  readonly holdings = computed<HoldingRow[]>(() => {
    this.market.page();
    this.crypto.cards();
    return this.portfolio.portfolio().holdings.map((h) => {
      const isCrypto = h.marketType === 'crypto';
      const price = isCrypto
        ? this.crypto.getPrice(h.symbol) || h.avgCost
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
        currency: isCrypto ? '$' : '₺',
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

  readonly stockValueTry = computed(() => this.bistHoldings().reduce((s, h) => s + h.value, 0));
  readonly stockValueUsd = computed(() => this.cryptoHoldings().reduce((s, h) => s + h.value, 0));
  readonly totalTry = computed(() => this.stockValueTry() + this.portfolio.cashTry());
  readonly totalUsd = computed(() => this.stockValueUsd() + this.portfolio.cashUsd());
  readonly pnlTry = computed(() => this.totalTry() - 1_000_000);
  readonly pnlUsd = computed(() => this.totalUsd() - 100_000);

  ngOnInit(): void {
    void this.portfolio.reload();
    this.market.loadMarket();
    this.crypto.load();
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

  displaySymbol(symbol: string, market: 'bist' | 'crypto'): string {
    if (market === 'crypto' && symbol.endsWith('USDT')) return symbol.slice(0, -4);
    return symbol;
  }

  tradeMsgColor(): string {
    return this.tradeMsg().includes('✓') ? 'var(--up)' : 'var(--down)';
  }

  cryptoMsgColor(): string {
    return this.cryptoMsg().includes('✓') ? 'var(--up)' : 'var(--down)';
  }

  formatQty(q: number, market: 'bist' | 'crypto'): string {
    if (market === 'bist') return String(Math.round(q));
    // Sabit basamak → fiyat tick'inde kolon genişliği oynamasın
    if (q >= 100) return q.toFixed(2);
    if (q >= 1) return q.toFixed(4);
    return q.toFixed(6);
  }

  formatHoldingPrice(v: number, market: 'bist' | 'crypto'): string {
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
    const usd = Number(this.cryptoUsd);
    if (!Number.isFinite(usd) || usd <= 0) {
      this.cryptoMsg.set('Geçerli bir USD tutarı gir.');
      return;
    }
    this.busyCrypto.set(true);
    const res = await this.portfolio.buyCrypto(this.cryptoSymbol, { quoteUsd: usd });
    this.cryptoMsg.set(
      res.error ?? `✓ ${formatNumber(usd)} $ ile ${this.displaySymbol(this.cryptoSymbol, 'crypto')} alındı.`,
    );
    this.busyCrypto.set(false);
  }

  async sellCrypto(): Promise<void> {
    const usd = Number(this.cryptoUsd);
    if (!Number.isFinite(usd) || usd <= 0) {
      this.cryptoMsg.set('Geçerli bir USD tutarı gir.');
      return;
    }
    const price = this.crypto.getPrice(this.cryptoSymbol);
    if (!price || price <= 0) {
      this.cryptoMsg.set('Fiyat bulunamadı.');
      return;
    }
    const qty = usd / price;
    this.busyCrypto.set(true);
    const res = await this.portfolio.sellCrypto(this.cryptoSymbol, qty);
    this.cryptoMsg.set(
      res.error ?? `✓ ${formatNumber(usd)} $ değerinde ${this.displaySymbol(this.cryptoSymbol, 'crypto')} satıldı.`,
    );
    this.busyCrypto.set(false);
  }
}
