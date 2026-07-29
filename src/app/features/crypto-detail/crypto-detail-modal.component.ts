import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CryptoDepth, CryptoFillPreview } from '../../core/models/crypto.model';
import { AuthService } from '../../core/services/auth.service';
import { CryptoApiService } from '../../core/services/crypto-api.service';
import { CryptoMarketService } from '../../core/services/crypto-market.service';
import { ModalService } from '../../core/services/modal.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { formatCryptoPrice, formatNumber } from '../../core/utils/format.util';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';
import { StockLogoComponent } from '../../shared/components/stock-logo/stock-logo.component';

@Component({
  selector: 'app-crypto-detail-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, FormsModule, StockLogoComponent],
  template: `
    <app-overlay [open]="modals.active() === 'cryptoDetail'" (closed)="modals.close()">
      @if (symbol()) {
        <div class="modal">
          <button class="m-close" type="button" (click)="modals.close()">✕</button>
          <div class="card-top">
            <app-stock-logo [symbol]="base()" [color]="color()" market="crypto" />
            <div>
              <h2>{{ base() }}</h2>
              <div class="sub">{{ symbol() }} · Spot USDT</div>
            </div>
          </div>

          <div class="stat-grid">
            <div class="stat">
              <div class="k">FİYAT</div>
              <div class="v mono">{{ formatCryptoPrice(price()) }} $</div>
            </div>
            <div class="stat">
              <div class="k">24S DEĞİŞİM</div>
              <div class="v mono" [style.color]="changePct() >= 0 ? 'var(--up)' : 'var(--down)'">
                {{ changePct() >= 0 ? '+' : '' }}%{{ formatNumber(changePct()) }}
              </div>
            </div>
            <div class="stat">
              <div class="k">USD BAKİYE</div>
              <div class="v mono">{{ formatNumber(portfolio.cashUsd()) }} $</div>
            </div>
          </div>

          <div class="depth-wrap">
            <div class="depth-col asks">
              <div class="depth-h">SATIŞ (ASK)</div>
              @for (l of asks(); track l.price) {
                <div class="depth-row">
                  <span class="mono p">{{ formatCryptoPrice(l.price) }}</span>
                  <span class="mono q">{{ formatQty(l.quantity) }}</span>
                </div>
              }
            </div>
            <div class="depth-col bids">
              <div class="depth-h">ALIŞ (BID)</div>
              @for (l of bids(); track l.price) {
                <div class="depth-row">
                  <span class="mono p">{{ formatCryptoPrice(l.price) }}</span>
                  <span class="mono q">{{ formatQty(l.quantity) }}</span>
                </div>
              }
            </div>
          </div>

          @if (auth.isLoggedIn()) {
            <div class="trade-mode">
              <button type="button" [class.active]="mode() === 'quote'" (click)="mode.set('quote')">
                USD tutar
              </button>
              <button type="button" [class.active]="mode() === 'qty'" (click)="mode.set('qty')">
                Miktar
              </button>
            </div>
            <div class="trade">
              <input
                class="f-input mono"
                type="number"
                min="0"
                step="any"
                [(ngModel)]="amount"
                [placeholder]="mode() === 'quote' ? 'Örn. 1000 USD' : 'Örn. 0.01'"
              />
              <button class="btn btn-buy" type="button" [disabled]="busy()" (click)="buy()">AL</button>
              <button
                class="btn btn-sell"
                type="button"
                [disabled]="busy() || !canSell()"
                [title]="canSell() ? '' : 'Bu coinden pozisyonun yok'"
                (click)="sell()"
              >SAT</button>
            </div>
            <button class="preview-btn" type="button" [disabled]="busy()" (click)="preview()">
              Emir önizle
            </button>
            @if (msg()) {
              <div class="trade-msg" [style.color]="msg().startsWith('✓') ? 'var(--up)' : 'var(--down)'">
                {{ msg() }}
              </div>
            }
            @if (fill(); as f) {
              <div class="fill-box">
                <div class="fill-h">
                  {{ f.side === 'buy' ? 'Alım' : 'Satım' }} · ort.
                  {{ formatCryptoPrice(f.avgPrice) }}$ · {{ formatQty(f.filledQuantity) }} ·
                  {{ formatNumber(f.total) }}$
                </div>
                @for (lv of f.levels; track lv.price + '-' + lv.quantity) {
                  <div class="fill-row mono">
                    {{ formatCryptoPrice(lv.price) }}$ × {{ formatQty(lv.quantity) }} =
                    {{ formatNumber(lv.cost) }}$
                  </div>
                }
              </div>
            }
          } @else {
            <p class="hint">İşlem için giriş yap.</p>
          }

          <div class="actions">
            <button class="btn btn-prem" type="button" (click)="openTimeMachine()">
              Zaman Makinesi'nde Aç
            </button>
          </div>
        </div>
      }
    </app-overlay>
  `,
  styles: `
    .modal {
      max-width: 560px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 26px;
      position: relative;
    }
    h2 { font-size: 22px; font-weight: 800; }
    .m-close {
      position: absolute; top: 16px; right: 16px;
      background: var(--panel2); border: 1px solid var(--line);
      color: var(--muted); width: 34px; height: 34px;
      border-radius: 10px; cursor: pointer;
    }
    .card-top {
      display: flex; align-items: center; gap: 12px;
      margin-top: 4px; margin-bottom: 16px;
    }
    .depth-wrap {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      margin: 16px 0;
    }
    .depth-col {
      background: var(--panel2);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 6px 10px 10px;
      max-height: 220px;
      overflow: auto;
      overscroll-behavior: contain;
    }
    .depth-h {
      font-size: 10px; font-weight: 800; letter-spacing: 0.5px;
      color: var(--muted); margin-bottom: 8px;
    }
    .asks .depth-row .p { color: var(--down); }
    .bids .depth-row .p { color: var(--up); }
    .depth-row {
      display: flex; justify-content: space-between;
      font-size: 12px; padding: 3px 0;
    }
    .trade-mode {
      display: flex; gap: 6px; margin-bottom: 8px;
      button {
        border: 1px solid var(--line); background: var(--panel2);
        color: var(--muted); border-radius: 8px; padding: 6px 10px;
        font-size: 12px; cursor: pointer;
        &.active { color: var(--text); border-color: var(--accent, #22c98a); }
      }
    }
    .trade { display: flex; gap: 8px; }
    .preview-btn {
      margin-top: 8px; width: 100%;
      border: 1px dashed var(--line); background: transparent;
      color: var(--muted); border-radius: 10px; padding: 8px;
      cursor: pointer; font-size: 12px;
    }
    .trade-msg { margin-top: 8px; font-size: 12.5px; font-weight: 600; }
    .fill-box {
      margin-top: 12px; padding: 10px 12px;
      background: var(--panel2); border: 1px solid var(--line);
      border-radius: 12px; font-size: 12px;
    }
    .fill-h { font-weight: 700; margin-bottom: 6px; }
    .fill-row { color: var(--muted); padding: 2px 0; }
    .hint { margin-top: 14px; color: var(--muted); font-size: 13px; }
    .actions { margin-top: 16px; }
    .btn-prem {
      width: 100%;
      border: 1px solid var(--line);
      background: var(--panel2);
      color: var(--text);
      border-radius: 12px;
      padding: 12px 14px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      &:hover { border-color: var(--accent, #22c98a); }
    }
  `,
})
export class CryptoDetailModalComponent {
  readonly modals = inject(ModalService);
  readonly auth = inject(AuthService);
  readonly portfolio = inject(PortfolioService);
  private readonly cryptoMarket = inject(CryptoMarketService);
  private readonly cryptoApi = inject(CryptoApiService);

  readonly formatNumber = formatNumber;
  readonly formatCryptoPrice = formatCryptoPrice;
  readonly symbol = signal('');
  readonly price = signal(0);
  readonly changePct = signal(0);
  readonly color = signal('#22c98a');
  readonly depth = signal<CryptoDepth | null>(null);
  readonly fill = signal<CryptoFillPreview | null>(null);
  readonly msg = signal('');
  readonly busy = signal(false);
  readonly mode = signal<'quote' | 'qty'>('quote');
  /** Boş başlar — kullanıcı tutar/miktar girmeli. */
  amount: number | null = null;

  readonly asks = signal<{ price: number; quantity: number }[]>([]);
  readonly bids = signal<{ price: number; quantity: number }[]>([]);
  private tradeSymbol: string | null = null;

  readonly ownedQty = computed(() => {
    const sym = this.symbol();
    if (!sym) return 0;
    const h = this.portfolio.portfolio().holdings.find(
      (x) => x.marketType === 'crypto' && x.symbol.toUpperCase() === sym.toUpperCase(),
    );
    return h?.quantity ?? 0;
  });

  readonly canSell = computed(() => this.ownedQty() > 0);

  constructor() {
    effect(() => {
      if (this.modals.active() !== 'cryptoDetail') {
        this.symbol.set('');
        this.fill.set(null);
        this.msg.set('');
        this.amount = null;
        this.tradeSymbol = null;
        return;
      }
      const sym = this.modals.stockSymbol();
      if (!sym) return;
      const upper = sym.toUpperCase();
      this.symbol.set(upper);
      if (this.tradeSymbol !== upper) {
        this.tradeSymbol = upper;
        this.msg.set('');
        this.amount = null;
        this.fill.set(null);
      }
      const card = this.cryptoMarket.getCard(sym);
      if (card) {
        this.price.set(card.close);
        this.changePct.set(card.changePct);
        this.color.set(card.color);
      }
      void this.loadDepth(sym);
    });
  }

  base(): string {
    const s = this.symbol();
    return s.endsWith('USDT') ? s.slice(0, -4) : s;
  }

  formatQty(q: number): string {
    if (q >= 1000) return formatNumber(q);
    if (q >= 1) return q.toFixed(4);
    return q.toPrecision(4);
  }

  private async loadDepth(symbol: string): Promise<void> {
    try {
      const d = await firstValueFrom(this.cryptoApi.getDepth(symbol));
      this.depth.set(d);
      this.asks.set([...(d.asks ?? [])].slice(0, 12).reverse());
      this.bids.set([...(d.bids ?? [])].slice(0, 12));
    } catch {
      this.msg.set('Derinlik yüklenemedi.');
    }
  }

  private parseAmount(): number {
    const n = Number(this.amount);
    return Number.isFinite(n) ? n : 0;
  }

  async preview(): Promise<void> {
    const sym = this.symbol();
    const amount = this.parseAmount();
    if (!sym) return;
    if (amount <= 0) {
      this.msg.set(this.mode() === 'quote' ? 'Önizleme için USD tutarı gir.' : 'Önizleme için miktar gir.');
      return;
    }
    this.busy.set(true);
    try {
      const body =
        this.mode() === 'quote'
          ? { symbol: sym, side: 'buy' as const, quoteUsd: amount }
          : { symbol: sym, side: 'buy' as const, quantity: amount };
      const f = await firstValueFrom(this.cryptoApi.quote(body));
      this.fill.set(f);
      this.msg.set(f.fullyFilled ? '✓ Önizleme hazır' : 'Derinlik yetersiz (tam fill yok)');
    } catch (e) {
      this.msg.set(e instanceof Error ? e.message : 'Önizleme başarısız');
    } finally {
      this.busy.set(false);
    }
  }

  async buy(): Promise<void> {
    const sym = this.symbol();
    if (!sym || this.busy()) return;
    const amount = this.parseAmount();
    if (amount <= 0) {
      this.msg.set(this.mode() === 'quote' ? 'Alım için USD tutarı gir.' : 'Alım için miktar gir.');
      return;
    }
    this.busy.set(true);
    const opts =
      this.mode() === 'quote' ? { quoteUsd: amount } : { quantity: amount };
    const r = await this.portfolio.buyCrypto(sym, opts);
    if (r.error) this.msg.set(r.error);
    else {
      this.fill.set(r.fill ?? null);
      this.msg.set(`✓ Alındı · ort. ${formatCryptoPrice(r.fill?.avgPrice ?? 0)}$`);
      void this.loadDepth(sym);
    }
    this.busy.set(false);
  }

  async sell(): Promise<void> {
    const sym = this.symbol();
    if (!sym || this.busy() || !this.canSell()) return;
    const amount = this.parseAmount();
    const qty =
      this.mode() === 'qty'
        ? amount
        : this.price() > 0
          ? amount / this.price()
          : 0;
    if (amount <= 0 || qty <= 0) {
      this.msg.set(this.mode() === 'quote' ? 'Satım için USD tutarı gir.' : 'Satım için miktar gir.');
      return;
    }
    this.busy.set(true);
    const r = await this.portfolio.sellCrypto(sym, qty);
    if (r.error) this.msg.set(r.error);
    else {
      this.fill.set(r.fill ?? null);
      this.msg.set(`✓ Satıldı · ort. ${formatCryptoPrice(r.fill?.avgPrice ?? 0)}$`);
      void this.loadDepth(sym);
    }
    this.busy.set(false);
  }

  openTimeMachine(): void {
    const sym = this.symbol();
    if (sym) this.modals.openTimeMachine(sym, 'crypto');
  }
}
