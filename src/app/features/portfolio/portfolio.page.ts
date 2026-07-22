import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CryptoMarketService } from '../../core/services/crypto-market.service';
import { MarketService } from '../../core/services/market.service';
import { ModalService } from '../../core/services/modal.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { formatCryptoPrice, formatInteger, formatNumber, symbolColor } from '../../core/utils/format.util';

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
  imports: [RouterLink, FormsModule, DatePipe],
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
          <select class="f-input" [(ngModel)]="tradeSymbol">
            @for (s of stockOptions(); track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
          <input class="f-input mono" type="number" min="1" step="1" [(ngModel)]="tradeLots" />
          <button class="btn btn-buy" type="button" [disabled]="busy()" (click)="buy()">AL</button>
          <button class="btn btn-sell" type="button" [disabled]="busy()" (click)="sell()">SAT</button>
        </div>
        @if (tradeMsg()) {
          <div class="trade-msg" [style.color]="tradeMsgColor()">{{ tradeMsg() }}</div>
        }

        <div class="sec-h">VARLIKLARIM</div>
        @if (!holdings().length) {
          <div class="pf-empty">Henüz pozisyon yok. Piyasadan alım yapabilirsin.</div>
        } @else {
          <table class="pf-table">
            <thead>
              <tr>
                <th>Sembol</th>
                <th>Piyasa</th>
                <th>Miktar</th>
                <th>Ort. Maliyet</th>
                <th class="r">Güncel</th>
                <th class="r">Değer</th>
                <th class="r">K/Z</th>
              </tr>
            </thead>
            <tbody>
              @for (h of holdings(); track h.marketType + h.symbol) {
                <tr>
                  <td>
                    <span class="dot" [style.background]="h.color"></span>
                    <b>{{ h.symbol }}</b>
                  </td>
                  <td>{{ h.marketType === 'crypto' ? 'Kripto' : 'BIST' }}</td>
                  <td class="mono">{{ formatQty(h.quantity, h.marketType) }}</td>
                  <td class="mono">{{ formatHoldingPrice(h.avgCost, h.marketType) }} {{ h.currency }}</td>
                  <td class="r mono">{{ formatHoldingPrice(h.price, h.marketType) }} {{ h.currency }}</td>
                  <td class="r mono">{{ formatHoldingPrice(h.value, h.marketType) }} {{ h.currency }}</td>
                  <td class="r mono" [style.color]="h.pnl >= 0 ? 'var(--up)' : 'var(--down)'">
                    {{ h.pnl >= 0 ? '+' : '' }}{{ formatNumber(h.pnl) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }

        <div class="sec-h">📜 İŞLEM GEÇMİŞİM</div>
        @for (tx of portfolio.portfolio().transactions; track tx.id) {
          <div class="tx">
            <span class="side" [class.al]="tx.side === 'buy'" [class.sat]="tx.side === 'sell'">
              {{ tx.side === 'buy' ? 'AL' : 'SAT' }}
            </span>
            <b>{{ tx.symbol }}</b>
            <span class="mono">
              {{ formatQty(tx.quantity, tx.marketType) }}
              · {{ formatHoldingPrice(tx.price, tx.marketType) }}
              {{ tx.marketType === 'crypto' ? '$' : '₺' }}
            </span>
            <span class="tag">{{ tx.marketType === 'crypto' ? 'CRYPTO' : 'BIST' }}</span>
            <span class="when">{{ tx.at | date: 'dd.MM.yyyy HH:mm' }}</span>
          </div>
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
      select { flex: 2; min-width: 160px; }
      input { flex: 1; min-width: 80px; }
    }
    .trade-msg { margin-top: 9px; font-size: 12.5px; min-height: 18px; font-weight: 600; }
    .pf-table {
      width: 100%; border-collapse: collapse; font-size: 12.5px;
      th {
        text-align: left; color: var(--muted); font-size: 10.5px;
        letter-spacing: 0.5px; padding: 7px 8px; border-bottom: 1px solid var(--line);
      }
      td { padding: 10px 8px; border-bottom: 1px solid var(--line); }
      .r { text-align: right; }
      .dot {
        display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 6px;
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

  tradeSymbol = 'THYAO';
  tradeLots = 10;
  readonly tradeMsg = signal('');
  readonly busy = signal(false);

  readonly stockOptions = computed(() => {
    const fromMarket = this.market.symbolOptions();
    const fromHoldings = this.portfolio
      .portfolio()
      .holdings.filter((h) => h.marketType === 'bist')
      .map((h) => h.symbol);
    return [...new Set([...fromHoldings, ...fromMarket, 'THYAO', 'GARAN'])].sort();
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

  readonly bistHoldings = computed(() => this.holdings().filter((h) => h.marketType === 'bist'));
  readonly cryptoHoldings = computed(() => this.holdings().filter((h) => h.marketType === 'crypto'));

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
  }

  avatar(): string {
    const name = this.auth.currentUser()?.displayName ?? '?';
    return name.slice(0, 1).toUpperCase();
  }

  tradeMsgColor(): string {
    return this.tradeMsg().includes('✓') ? 'var(--up)' : 'var(--down)';
  }

  formatQty(q: number, market: 'bist' | 'crypto'): string {
    if (market === 'bist') return String(Math.round(q));
    if (q >= 1) return q.toFixed(4);
    return q.toPrecision(4);
  }

  formatHoldingPrice(v: number, market: 'bist' | 'crypto'): string {
    return market === 'crypto' ? formatCryptoPrice(v) : formatNumber(v);
  }

  async buy(): Promise<void> {
    this.busy.set(true);
    const err = await this.portfolio.buy(this.tradeSymbol, this.tradeLots);
    this.tradeMsg.set(err ?? `✓ ${this.tradeLots} lot ${this.tradeSymbol} alındı.`);
    this.busy.set(false);
  }

  async sell(): Promise<void> {
    this.busy.set(true);
    const err = await this.portfolio.sell(this.tradeSymbol, this.tradeLots);
    this.tradeMsg.set(err ?? `✓ ${this.tradeLots} lot ${this.tradeSymbol} satıldı.`);
    this.busy.set(false);
  }
}
