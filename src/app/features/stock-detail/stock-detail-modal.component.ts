import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { MarketService } from '../../core/services/market.service';
import { ModalService } from '../../core/services/modal.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { UsMarketService } from '../../core/services/us-market.service';
import { UsStockApiService } from '../../core/services/us-stock-api.service';
import { StockCardView, StockDetail } from '../../core/models/stock.model';
import { changePercent, formatNumber, symbolColor } from '../../core/utils/format.util';
import { tierBadge } from '../../core/constants/bist-tiers';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';
import { StockLogoComponent } from '../../shared/components/stock-logo/stock-logo.component';

@Component({
  selector: 'app-stock-detail-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, FormsModule, StockLogoComponent],
  template: `
    <app-overlay [open]="isOpen()" (closed)="modals.close()">
      @if (card(); as d) {
        <div class="modal">
          <button class="m-close" type="button" (click)="modals.close()">✕</button>
          <div class="card-top">
            <app-stock-logo [symbol]="d.symbol" [color]="d.color" [market]="isUsMode() ? 'us' : 'bist'" />
            <div>
              <h2>{{ d.symbol }}</h2>
              <div class="sub">{{ d.name }}</div>
            </div>
          </div>

          <div class="stat-grid">
            <div class="stat">
              <div class="k">SON FİYAT</div>
              <div class="v mono">{{ formatNumber(d.close) }} {{ currencySymbol() }}</div>
            </div>
            <div class="stat">
              <div class="k">GÜNLÜK DEĞİŞİM</div>
              <div class="v mono" [style.color]="d.changePct >= 0 ? 'var(--up)' : 'var(--down)'">
                {{ d.changePct >= 0 ? '+' : '' }}%{{ formatNumber(d.changePct) }}
              </div>
            </div>
            <div class="stat">
              <div class="k">HACİM</div>
              <div class="v mono">{{ formatNumber(d.volume) }} mn {{ currencySymbol() }}</div>
            </div>
          </div>

          @if (isUsMode()) {
            <div class="us-note">
              🇺🇸 ABD hisseleri şu an sadece görüntüleme + Zaman Makinesi için — alım/satım yakında.
            </div>
          } @else if (auth.isLoggedIn()) {
            <div class="trade" style="margin-top: 16px">
              <input
                class="f-input mono"
                type="number"
                min="1"
                step="1"
                [(ngModel)]="lots"
                placeholder="Lot miktarı giriniz"
              />
              <button class="btn btn-buy" type="button" [disabled]="busy()" (click)="buy()">AL</button>
              <button
                class="btn btn-sell"
                type="button"
                [disabled]="busy() || !canSell()"
                [title]="canSell() ? '' : 'Bu hisseden pozisyonun yok'"
                (click)="sell()"
              >SAT</button>
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

    .us-note {
      margin-top: 16px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px dashed var(--line);
      background: var(--panel2);
      font-size: 12px;
      line-height: 1.5;
      color: var(--muted);
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
  private readonly usMarket = inject(UsMarketService);
  private readonly portfolio = inject(PortfolioService);
  private readonly stockApi = inject(StockApiService);
  private readonly usStockApi = inject(UsStockApiService);

  readonly formatNumber = formatNumber;
  readonly card = signal<StockCardView | null>(null);
  readonly msg = signal('');
  readonly busy = signal(false);
  /** Boş başlar — kullanıcı lot girmeli. */
  lots: number | null = null;
  private fetchFor: string | null = null;
  private tradeSymbol: string | null = null;

  readonly isUsMode = computed(() => this.modals.active() === 'usStockDetail');
  readonly isOpen = computed(
    () => this.modals.active() === 'stockDetail' || this.modals.active() === 'usStockDetail',
  );
  readonly currencySymbol = computed(() => (this.isUsMode() ? '$' : '₺'));

  readonly ownedLots = computed(() => {
    const sym = this.card()?.symbol;
    if (!sym || this.isUsMode()) return 0;
    const h = this.portfolio.portfolio().holdings.find(
      (x) => x.marketType === 'bist' && x.symbol.toUpperCase() === sym.toUpperCase(),
    );
    return h?.quantity ?? h?.lots ?? 0;
  });

  readonly canSell = computed(() => this.ownedLots() > 0);

  constructor() {
    // Önceki sürüm loadMarket() çağırıyordu ve getCard() üzerinden live sinyali
    // okuyordu → istek bitince effect yeniden tetiklenip sonsuz /api/stocks döngüsü.
    effect(() => {
      if (!this.isOpen()) {
        this.card.set(null);
        this.msg.set('');
        this.lots = null;
        this.fetchFor = null;
        this.tradeSymbol = null;
        return;
      }

      const symbol = this.modals.stockSymbol();
      if (!symbol) return;

      if (this.tradeSymbol !== symbol) {
        this.tradeSymbol = symbol;
        this.msg.set('');
        this.lots = null;
      }

      const us = this.isUsMode();
      const existing = us ? this.usMarket.getCard(symbol) : this.market.getCard(symbol);
      if (existing) {
        this.card.set(existing);
        return;
      }

      // Liste sayfasında yoksa (ör. taçtan açıldı) tek hisse çek — untracked ki döngü olmasın.
      untracked(() => this.fetchDetail(symbol, us));
    });
  }

  private fetchDetail(symbol: string, us: boolean): void {
    if (this.fetchFor === symbol) return;
    this.fetchFor = symbol;

    const api$ = us ? this.usStockApi.getStock(symbol) : this.stockApi.getStock(symbol);
    api$.subscribe({
      next: (detail) => {
        if (!this.isOpen() || this.modals.stockSymbol() !== symbol) return;
        this.card.set(toCardView(detail, us));
      },
      error: () => {
        if (this.fetchFor === symbol) this.fetchFor = null;
      },
    });
  }

  async buy(): Promise<void> {
    const d = this.card();
    if (!d || this.busy() || this.isUsMode()) return;
    const lots = Number(this.lots);
    if (!Number.isFinite(lots) || lots < 1) {
      this.msg.set('Alım için lot miktarı gir.');
      return;
    }
    this.busy.set(true);
    const err = await this.portfolio.buy(d.symbol, Math.floor(lots), d.close);
    if (err === '__bist_closed__') this.msg.set('');
    else this.msg.set(err ?? `✓ ${Math.floor(lots)} lot alındı.`);
    this.busy.set(false);
  }

  async sell(): Promise<void> {
    const d = this.card();
    if (!d || this.busy() || !this.canSell() || this.isUsMode()) return;
    const lots = Number(this.lots);
    if (!Number.isFinite(lots) || lots < 1) {
      this.msg.set('Satım için lot miktarı gir.');
      return;
    }
    this.busy.set(true);
    const err = await this.portfolio.sell(d.symbol, Math.floor(lots), d.close);
    if (err === '__bist_closed__') this.msg.set('');
    else this.msg.set(err ?? `✓ ${Math.floor(lots)} lot satıldı.`);
    this.busy.set(false);
  }

  openTimeMachine(): void {
    const symbol = this.card()?.symbol;
    const market = this.isUsMode() ? 'us' : 'bist';
    this.modals.close();
    if (symbol) this.modals.openTimeMachine(symbol, market);
  }
}

function toCardView(stock: StockDetail, us: boolean): StockCardView {
  // recentPrices API'de tarihe göre artan; [0]=en eski, [^1]=son gün.
  // lastClose/previousClose/lastVolume varsa onları kullan; yoksa son iki günden türet.
  const prices = stock.recentPrices ?? [];
  const latest = prices.length ? prices[prices.length - 1] : null;
  const prior = prices.length > 1 ? prices[prices.length - 2] : null;
  const close = stock.lastClose ?? latest?.close ?? 0;
  const open = stock.lastOpen ?? latest?.open ?? close;
  const prev = stock.previousClose ?? prior?.close ?? close;
  const spark =
    stock.sparkline && stock.sparkline.length
      ? stock.sparkline.map(Number)
      : prices.map((p) => Number(p.close));

  return {
    ...stock,
    close,
    open,
    changePct: changePercent(close, prev),
    sparkline: spark.length ? spark : [close],
    volume: (stock.lastVolume ?? latest?.volume ?? 0) / 1_000_000,
    color: symbolColor(stock.symbol),
    tierBadge: us ? 'ABD' : tierBadge(stock.bistIndices ?? []),
    crownLabel: stock.topGainerLabel ?? null,
    crownPeriod: stock.topGainerPeriod ?? null,
    crownReturnPct: stock.topGainerReturnPct ?? null,
  };
}
