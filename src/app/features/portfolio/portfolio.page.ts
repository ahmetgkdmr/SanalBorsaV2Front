import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MarketService } from '../../core/services/market.service';
import { ModalService } from '../../core/services/modal.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { formatInteger, formatNumber, symbolColor } from '../../core/utils/format.util';

interface HoldingRow {
  symbol: string;
  lots: number;
  avgCost: number;
  price: number;
  value: number;
  pnl: number;
  pnlPct: number;
  color: string;
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
            <h2>{{ auth.currentUser()?.username }}</h2>
            <div class="sub">Sanal yatırımcı · başlangıç 1.000.000 ₺</div>
          </div>
          <div class="total">
            <div class="k">TOPLAM VARLIK</div>
            <div class="v mono">{{ formatInteger(totalValue()) }} ₺</div>
          </div>
        </div>

        <div class="stat-grid" style="margin-top: 14px">
          <div class="stat">
            <div class="k">NAKİT</div>
            <div class="v mono">{{ formatInteger(portfolio.portfolio().cash) }} ₺</div>
          </div>
          <div class="stat">
            <div class="k">HİSSE DEĞERİ</div>
            <div class="v mono">{{ formatInteger(stockValue()) }} ₺</div>
          </div>
          <div class="stat">
            <div class="k">K/Z</div>
            <div class="v mono" [style.color]="pnl() >= 0 ? 'var(--up)' : 'var(--down)'">
              {{ pnl() >= 0 ? '+' : '' }}{{ formatInteger(pnl()) }} ₺
            </div>
          </div>
        </div>

        <div class="sec-h">HIZLI İŞLEM</div>
        <div class="trade">
          <select class="f-input" [(ngModel)]="tradeSymbol">
            @for (s of stockOptions(); track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
          <input class="f-input mono" type="number" min="1" step="1" [(ngModel)]="tradeLots" />
          <button class="btn btn-buy" type="button" (click)="buy()">AL</button>
          <button class="btn btn-sell" type="button" (click)="sell()">SAT</button>
        </div>
        @if (tradeMsg()) {
          <div class="trade-msg" [style.color]="tradeMsgColor()">{{ tradeMsg() }}</div>
        }

        <div class="sec-h">VARLIKLARIM</div>
        @if (!holdings().length) {
          <div class="pf-empty">Henüz hisse yok. Piyasadan alım yapabilirsin.</div>
        } @else {
          <table class="pf-table">
            <thead>
              <tr>
                <th>Hisse</th>
                <th>Lot</th>
                <th>Ort. Maliyet</th>
                <th class="r">Güncel</th>
                <th class="r">Değer</th>
                <th class="r">K/Z</th>
              </tr>
            </thead>
            <tbody>
              @for (h of holdings(); track h.symbol) {
                <tr>
                  <td>
                    <span class="dot" [style.background]="h.color"></span>
                    <b>{{ h.symbol }}</b>
                  </td>
                  <td class="mono">{{ h.lots }}</td>
                  <td class="mono">{{ formatNumber(h.avgCost) }} ₺</td>
                  <td class="r mono">{{ formatNumber(h.price) }} ₺</td>
                  <td class="r mono">{{ formatInteger(h.value) }} ₺</td>
                  <td class="r mono" [style.color]="h.pnl >= 0 ? 'var(--up)' : 'var(--down)'">
                    {{ h.pnl >= 0 ? '+' : '' }}{{ formatInteger(h.pnl) }}
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
            <span class="mono">{{ tx.lots }} lot · {{ formatNumber(tx.price) }} ₺</span>
            <span class="when">{{ tx.at | date: 'dd.MM.yyyy HH:mm' }}</span>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .pf-hero {
      display: flex;
      align-items: center;
      gap: 18px;
      margin-top: 24px;
      background: linear-gradient(135deg, var(--panel), #182036);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 24px;
      flex-wrap: wrap;
    }

    .avatar {
      width: 74px;
      height: 74px;
      border-radius: 20px;
      background: linear-gradient(135deg, #22c98a, #0e7a55);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 800;
      color: #04180f;
    }

    .pf-hero h2 {
      font-size: 24px;
    }

    .total {
      margin-left: auto;
      text-align: right;

      .k {
        font-size: 11px;
        color: var(--muted);
        font-weight: 700;
        letter-spacing: 0.5px;
      }

      .v {
        font-size: 32px;
        font-weight: 800;
      }
    }

    .trade {
      display: flex;
      gap: 9px;
      flex-wrap: wrap;
      align-items: center;

      select {
        flex: 2;
        min-width: 160px;
      }

      input {
        flex: 1;
        min-width: 80px;
      }
    }

    .trade-msg {
      margin-top: 9px;
      font-size: 12.5px;
      min-height: 18px;
      font-weight: 600;
    }

    .pf-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;

      th {
        text-align: left;
        color: var(--muted);
        font-size: 10.5px;
        letter-spacing: 0.5px;
        padding: 7px 8px;
        border-bottom: 1px solid var(--line);
      }

      td {
        padding: 10px 8px;
        border-bottom: 1px solid var(--line);
      }

      .r {
        text-align: right;
      }

      .dot {
        display: inline-block;
        width: 9px;
        height: 9px;
        border-radius: 3px;
        margin-right: 6px;
      }
    }

    .pf-empty {
      margin-top: 12px;
      padding: 20px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      background: var(--panel2);
      border: 1px dashed var(--line);
      border-radius: 12px;
    }

    .tx {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 13px;
      background: var(--panel2);
      border: 1px solid var(--line);
      border-radius: 11px;
      margin-bottom: 7px;
      font-size: 12.5px;

      .side {
        font-weight: 800;
        font-size: 11px;
        padding: 4px 9px;
        border-radius: 7px;
        letter-spacing: 0.5px;

        &.al {
          background: var(--up-bg);
          color: var(--up);
        }

        &.sat {
          background: var(--down-bg);
          color: var(--down);
        }
      }

      .when {
        margin-left: auto;
        color: var(--muted);
        font-size: 11px;
        white-space: nowrap;
      }
    }

    @media (max-width: 600px) {
      .pf-hero .total {
        margin-left: 0;
        text-align: left;
        width: 100%;
      }

      .pf-table th:nth-child(3),
      .pf-table td:nth-child(3) {
        display: none;
      }
    }
  `,
})
export class PortfolioPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly portfolio = inject(PortfolioService);
  readonly modals = inject(ModalService);
  private readonly market = inject(MarketService);

  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;

  tradeSymbol = 'THYAO';
  tradeLots = 10;
  readonly tradeMsg = signal('');

  readonly stockOptions = computed(() => {
    const fromMarket = this.market.cards().map((c) => c.symbol);
    const fromHoldings = this.portfolio.portfolio().holdings.map((h) => h.symbol);
    return [...new Set([...fromHoldings, ...fromMarket, 'THYAO', 'GARAN'])].sort();
  });

  readonly holdings = computed<HoldingRow[]>(() => {
    this.market.cards();
    return this.portfolio.portfolio().holdings.map((h) => {
      const price = this.market.getPrice(h.symbol) || h.avgCost;
      const value = price * h.lots;
      const cost = h.avgCost * h.lots;
      return {
        ...h,
        price,
        value,
        pnl: value - cost,
        pnlPct: cost ? ((value - cost) / cost) * 100 : 0,
        color: symbolColor(h.symbol),
      };
    });
  });

  readonly stockValue = computed(() => this.holdings().reduce((s, h) => s + h.value, 0));
  readonly totalValue = computed(() => this.stockValue() + this.portfolio.portfolio().cash);
  readonly pnl = computed(() => this.totalValue() - 1_000_000);

  ngOnInit(): void {
    this.portfolio.reload();
    this.market.loadMarket();
  }

  avatar(): string {
    const name = this.auth.currentUser()?.username ?? '?';
    return name.slice(0, 1).toUpperCase();
  }

  tradeMsgColor(): string {
    return this.tradeMsg().includes('✓') ? 'var(--up)' : 'var(--down)';
  }

  buy(): void {
    const price = this.market.getPrice(this.tradeSymbol);
    if (!price) {
      this.tradeMsg.set('Fiyat bulunamadı.');
      return;
    }
    const err = this.portfolio.buy(this.tradeSymbol, this.tradeLots, price);
    this.tradeMsg.set(err ?? `✓ ${this.tradeLots} lot ${this.tradeSymbol} alındı.`);
  }

  sell(): void {
    const price = this.market.getPrice(this.tradeSymbol);
    if (!price) {
      this.tradeMsg.set('Fiyat bulunamadı.');
      return;
    }
    const err = this.portfolio.sell(this.tradeSymbol, this.tradeLots, price);
    this.tradeMsg.set(err ?? `✓ ${this.tradeLots} lot ${this.tradeSymbol} satıldı.`);
  }
}
