import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { StockApiService, TopGainerItem } from '../../../../core/services/stock-api.service';
import { ModalService } from '../../../../core/services/modal.service';
import { formatAssetPrice, formatNumber, symbolColor } from '../../../../core/utils/format.util';
import { StockLogoComponent } from '../../../../shared/components/stock-logo/stock-logo.component';

@Component({
  selector: 'app-top-gainers-crown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StockLogoComponent],
  template: `
    @if (items().length) {
      <section class="crown-section">
        <div class="crown-head">
          <span class="crown-emoji" aria-hidden="true">👑</span>
          <div>
            <h3>Dönem Şampiyonları</h3>
            @if (asOf()) {
              <p class="sub">
                Son kapanış: {{ formatDate(asOf()!) }}
                @if (computedAt()) {
                  · güncellendi: {{ formatDateTime(computedAt()!) }}
                }
              </p>
            }
          </div>
        </div>

        <div class="crown-scroller">
          @if (canScrollLeft()) {
            <button class="scroll-hint left" type="button" aria-label="Sola kaydır" (click)="nudge(-1)">‹</button>
          }
          @if (canScrollRight()) {
            <button class="scroll-hint right" type="button" aria-label="Sağa kaydır" (click)="nudge(1)">›</button>
          }

        <div class="crown-grid" #grid (scroll)="onScroll()">
          @for (item of items(); track item.period) {
            <button
              type="button"
              class="crown-card"
              [attr.data-period]="item.period"
              [title]="item.periodLabel"
              (click)="open(item)"
            >
              <div class="ribbon">
                <span class="crown-mini">👑</span>
                <span>{{ shortLabel(item) }}</span>
              </div>

              <div class="body">
                <app-stock-logo
                  [symbol]="displaySymbol(item)"
                  [color]="color(item)"
                  [market]="marketType()"
                  size="sm"
                />
                <div class="meta">
                  <div class="tick">{{ displaySymbol(item) }}</div>
                  <div class="name">{{ item.name }}</div>
                </div>
              </div>

              <div class="ret mono">+{{ formatNumber(item.returnPct) }}%</div>

              <div class="foot mono">
                <span>{{ formatAssetPrice(item.startPrice, marketType()) }} {{ currencySym }}</span>
                <span class="arrow">→</span>
                <span>{{ formatAssetPrice(item.endPrice, marketType()) }} {{ currencySym }}</span>
              </div>
            </button>
          }
        </div>
        </div>
      </section>
    }
  `,
  styles: `
    .crown-section {
      margin: 16px 0 6px;
      padding: 12px 0 4px;
      border-radius: 0;
      border: none;
      border-top: 1px solid var(--line);
      background: transparent;
      box-shadow: none;
    }

    .crown-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .crown-emoji {
      font-size: 18px;
      filter: none;
    }

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.15px;
      color: var(--crown-title);
    }

    .sub {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--muted);
    }

    .crown-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }

    .crown-scroller { position: relative; }

    /* Kaydırma ipucu okları — sadece o yönde kaydırılacak içerik varsa görünür. */
    .scroll-hint {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: var(--panel);
      color: var(--text);
      font-size: 16px;
      line-height: 1;
      padding: 0 0 2px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
      transition: background 0.15s, transform 0.15s;

      &:hover { background: var(--chip-hover); }
      &.left { left: -4px; }
      &.right { right: -4px; }
    }

    @media (max-width: 980px) {
      .crown-grid {
        display: flex;
        overflow-x: auto;
        gap: 8px;
        padding-bottom: 2px;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;

        /* Kalın varsayılan kaydırma çubuğu yerine ince, soluk bir çizgi. */
        scrollbar-width: thin;
        scrollbar-color: color-mix(in srgb, var(--text) 22%, transparent) transparent;

        &::-webkit-scrollbar { height: 4px; }
        &::-webkit-scrollbar-track { background: transparent; }
        &::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--text) 20%, transparent);
          border-radius: 999px;
        }
      }

      .crown-card {
        flex: 0 0 148px;
        scroll-snap-align: start;
      }
    }

    .crown-card {
      text-align: left;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      padding: 0;
      overflow: hidden;
      cursor: pointer;
      transition: border-color 0.18s ease, background 0.18s ease;
      display: flex;
      flex-direction: column;
      min-width: 0;

      &:hover {
        border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
        background: color-mix(in srgb, var(--panel) 92%, var(--panel2));
      }
    }

    .ribbon {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15px;
      background: linear-gradient(90deg, #f0c040, #e8a317);
      color: #1a1206;
    }

    .crown-card[data-period='week'] .ribbon {
      background: linear-gradient(90deg, #7dd3a0, #3cb371);
      color: #062012;
    }
    .crown-card[data-period='year'] .ribbon {
      background: linear-gradient(90deg, #b388ff, #7c4dff);
      color: #140a22;
    }
    .crown-card[data-period='fiveyear'] .ribbon {
      background: linear-gradient(90deg, #5bbcff, #2f80ed);
      color: #061018;
    }
    .crown-card[data-period='tenyear'] .ribbon {
      background: linear-gradient(90deg, #ff8a65, #e64a19);
      color: #1a0a06;
    }

    .crown-mini { font-size: 12px; line-height: 1; }

    .body {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px 4px;
      min-width: 0;
    }

    .meta { min-width: 0; }
    .tick {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .name {
      font-size: 10px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ret {
      padding: 2px 10px 6px;
      font-size: 15px;
      font-weight: 700;
      color: var(--up);
    }

    .foot {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 10px 10px;
      font-size: 10px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
    }

    .arrow { opacity: 0.6; }
  `,
})
export class TopGainersCrownComponent {
  private readonly api = inject(StockApiService);
  private readonly modals = inject(ModalService);

  /** bist | crypto | us — sekme değişince yeniden yüklenir */
  readonly marketType = input<'bist' | 'crypto' | 'us'>('bist');

  readonly items = signal<TopGainerItem[]>([]);
  readonly asOf = signal<string | null>(null);
  readonly computedAt = signal<string | null>(null);
  readonly formatNumber = formatNumber;
  readonly formatAssetPrice = formatAssetPrice;

  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);

  get currencySym(): string {
    return this.marketType() === 'bist' ? '₺' : '$';
  }

  constructor() {
    effect(() => {
      const market = this.marketType();
      this.api.getTopGainers(market).subscribe({
        next: (res) => {
          this.items.set(res.items ?? []);
          this.asOf.set(res.asOfDate);
          this.computedAt.set(res.computedAt ?? null);
          // Kartlar DOM'a basıldıktan sonra ok görünürlüğünü hesapla.
          setTimeout(() => this.onScroll());
        },
        error: () => this.items.set([]),
      });
    });

    afterNextRender(() => {
      this.onScroll();
      window.addEventListener('resize', this.onResize, { passive: true });
    });
  }

  private readonly onResize = () => this.onScroll();

  /** Kaydırma konumuna göre sol/sağ ok göstergelerini günceller. */
  onScroll(): void {
    const el = this.grid()?.nativeElement;
    if (!el) {
      this.canScrollLeft.set(false);
      this.canScrollRight.set(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    this.canScrollLeft.set(el.scrollLeft > 4);
    this.canScrollRight.set(max > 4 && el.scrollLeft < max - 4);
  }

  /** Ok tıklanınca bir kart genişliği kadar kaydırır. */
  nudge(direction: 1 | -1): void {
    const el = this.grid()?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  shortLabel(item: TopGainerItem): string {
    if (item.periodShortLabel) return item.periodShortLabel;
    switch (item.period) {
      case 'week': return 'Son 1 hafta';
      case 'month': return 'Son 1 ay';
      case 'year': return 'Son 1 yıl';
      case 'fiveyear': return 'Son 5 yıl';
      case 'tenyear': return 'Son 10 yıl';
      default: return item.periodLabel;
    }
  }

  displaySymbol(item: TopGainerItem): string {
    if (this.marketType() !== 'crypto') return item.symbol;
    const s = item.symbol.toUpperCase();
    return s.endsWith('USDT') ? s.slice(0, -4) : s;
  }

  color(item: TopGainerItem): string {
    return symbolColor(this.displaySymbol(item));
  }

  /** Karta tıklayınca doğrudan Zaman Makinesi'ni bu dönemin başlangıç tarihiyle açar. */
  open(item: TopGainerItem): void {
    this.modals.openTimeMachine(item.symbol, this.marketType(), item.startDate);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** Hesaplamanın gerçekten çalıştığı an — sabit "her gece 23:05" yerine. */
  formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
