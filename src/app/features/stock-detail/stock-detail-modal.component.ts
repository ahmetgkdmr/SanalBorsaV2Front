import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { MarketService } from '../../core/services/market.service';
import { ModalService } from '../../core/services/modal.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { StockCardView } from '../../core/models/stock.model';
import { formatNumber } from '../../core/utils/format.util';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';
import { StockLogoComponent } from '../../shared/components/stock-logo/stock-logo.component';

@Component({
  selector: 'app-stock-detail-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, FormsModule, StockLogoComponent],
  template: `
    <app-overlay [open]="modals.active() === 'stockDetail'" (closed)="modals.close()">
      @if (card(); as d) {
        <div class="modal">
          <button class="m-close" type="button" (click)="modals.close()">✕</button>
          <div class="card-top">
            <app-stock-logo [symbol]="d.symbol" [color]="d.color" />
            <div>
              <h2>{{ d.symbol }}</h2>
              <div class="sub">{{ d.name }}</div>
            </div>
          </div>

          <div class="stat-grid">
            <div class="stat">
              <div class="k">SON FİYAT</div>
              <div class="v mono">{{ formatNumber(d.close) }} ₺</div>
            </div>
            <div class="stat">
              <div class="k">GÜNLÜK DEĞİŞİM</div>
              <div class="v mono" [style.color]="d.changePct >= 0 ? 'var(--up)' : 'var(--down)'">
                {{ d.changePct >= 0 ? '+' : '' }}%{{ formatNumber(d.changePct) }}
              </div>
            </div>
            <div class="stat">
              <div class="k">HACİM</div>
              <div class="v mono">{{ formatNumber(d.volume) }} mn ₺</div>
            </div>
          </div>

          @if (auth.isLoggedIn()) {
            <div class="trade" style="margin-top: 16px">
              <input class="f-input mono" type="number" min="1" [(ngModel)]="lots" />
              <button class="btn btn-buy" type="button" [disabled]="busy()" (click)="buy()">AL</button>
              <button class="btn btn-sell" type="button" [disabled]="busy()" (click)="sell()">SAT</button>
            </div>
            @if (msg()) {
              <div class="trade-msg" [style.color]="msg().startsWith('✓') ? 'var(--up)' : 'var(--down)'">
                {{ msg() }}
              </div>
            }
          }

          <div class="actions">
            <button class="btn btn-prem" type="button" (click)="openTimeMachine()">
              🕰️ Zaman Makinesi'nde Aç
            </button>
          </div>
        </div>
      }
    </app-overlay>
  `,
  styles: `
    .modal {
      max-width: 480px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 26px;
      position: relative;
    }

    h2 {
      font-size: 22px;
      font-weight: 800;
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

    .card-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 4px;
      margin-bottom: 16px;
    }

    .trade {
      display: flex;
      gap: 8px;
    }

    .trade-msg {
      margin-top: 8px;
      font-size: 12.5px;
      font-weight: 600;
    }

    .actions {
      margin-top: 20px;
      display: flex;

      .btn {
        flex: 1;
        justify-content: center;
      }
    }
  `,
})
export class StockDetailModalComponent {
  readonly modals = inject(ModalService);
  readonly auth = inject(AuthService);
  private readonly market = inject(MarketService);
  private readonly portfolio = inject(PortfolioService);

  readonly formatNumber = formatNumber;
  readonly card = signal<StockCardView | null>(null);
  readonly msg = signal('');
  readonly busy = signal(false);
  lots = 10;

  constructor() {
    effect(() => {
      if (this.modals.active() !== 'stockDetail') {
        this.card.set(null);
        this.msg.set('');
        return;
      }
      const symbol = this.modals.stockSymbol();
      if (!symbol) return;
      this.market.loadMarket();
      this.card.set(this.market.getCard(symbol) ?? null);
    });

    effect(() => {
      const symbol = this.modals.stockSymbol();
      if (this.modals.active() !== 'stockDetail' || !symbol) return;
      this.card.set(this.market.getCard(symbol) ?? null);
      this.market.page();
    });
  }

  async buy(): Promise<void> {
    const d = this.card();
    if (!d || this.busy()) return;
    this.busy.set(true);
    const err = await this.portfolio.buy(d.symbol, this.lots, d.close);
    this.msg.set(err ?? `✓ ${this.lots} lot alındı.`);
    this.busy.set(false);
  }

  async sell(): Promise<void> {
    const d = this.card();
    if (!d || this.busy()) return;
    this.busy.set(true);
    const err = await this.portfolio.sell(d.symbol, this.lots, d.close);
    this.msg.set(err ?? `✓ ${this.lots} lot satıldı.`);
    this.busy.set(false);
  }

  openTimeMachine(): void {
    const symbol = this.card()?.symbol;
    this.modals.close();
    if (symbol) this.modals.openTimeMachine(symbol, 'bist');
  }
}
