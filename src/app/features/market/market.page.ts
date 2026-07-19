import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { INDEX_TABS } from '../../core/constants/bist-tiers';
import { MarketFilter } from '../../core/models/stock.model';
import { MARKET_PAGE_SIZE, MarketService } from '../../core/services/market.service';
import { ModalService } from '../../core/services/modal.service';
import { StockCardComponent } from './components/stock-card/stock-card.component';
import { TopGainersCrownComponent } from './components/top-gainers-crown/top-gainers-crown.component';

type PageItem = number | 'ellipsis';

@Component({
  selector: 'app-market-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StockCardComponent, TopGainersCrownComponent],
  template: `
    <section class="page">
      <div class="controls">
        <div class="tabs-row">
          <div class="tabs" role="tablist">
            @for (tab of tabs; track tab.id) {
              <button
                class="tab"
                type="button"
                [class.active]="market.filter() === tab.id"
                [attr.data-group]="tab.group ?? null"
                (click)="setFilter(tab.id)"
              >
                {{ tab.label }}
              </button>
            }
          </div>
        </div>

        <div class="search-row">
          <input
            class="search"
            type="text"
            placeholder="Hisse ara (ör. THYAO)"
            [ngModel]="searchInput"
            (ngModelChange)="onSearch($event)"
          />
          <span class="count">{{ market.serverTotalCount() }} hisse</span>
        </div>
      </div>

      <app-top-gainers-crown />

      @if (market.dataAsOf()) {
        <div class="data-note">
          <span>ℹ️</span>
          <span>
            Fiyatlar <b>{{ formatDate(market.dataAsOf()!) }}</b> tarihli son kapanış verilerini içermektedir.
            Grafikler son 28 günlük kapanış fiyatlarına göre oluşturulmuştur.
          </span>
        </div>
      }

      @if (market.loading()) {
        <p class="status">Yükleniyor…</p>
      } @else if (market.error()) {
        <p class="status error">
          {{ market.error() }}
          <button class="retry" type="button" (click)="market.reloadMarket()">Tekrar dene</button>
        </p>
      } @else {
        <div class="grid">
          @for (card of market.cards(); track card.symbol) {
            <app-stock-card [stock]="card" (selected)="openDetail($event)" />
          }
        </div>

        @if (!market.cards().length) {
          <p class="status">Bu sayfada gösterilecek hisse yok.</p>
        }

        <nav class="pager" aria-label="Hisse sayfaları">
          <p class="pager-meta mono">
            <span>{{ rangeLabel().from }}–{{ rangeLabel().to }}</span>
            / {{ rangeLabel().total }} hisse
            <span class="sep">·</span>
            Sayfa <b>{{ market.page() }}</b> / <b>{{ market.totalPages() }}</b>
          </p>

          <div class="pager-btns">
            <button
              type="button"
              class="nav"
              title="İlk sayfa"
              [disabled]="market.page() === 1"
              (click)="market.goToPage(1)"
            >
              «
            </button>
            <button
              type="button"
              class="nav"
              title="Önceki sayfa"
              [disabled]="market.page() === 1"
              (click)="market.goToPage(market.page() - 1)"
            >
              ←
            </button>

            @for (item of pageItems(); track $index) {
              @if (item === 'ellipsis') {
                <span class="dots">…</span>
              } @else {
                <button
                  type="button"
                  [class.cur]="item === market.page()"
                  (click)="market.goToPage(item)"
                >
                  {{ item }}
                </button>
              }
            }

            <button
              type="button"
              class="nav"
              title="Sonraki sayfa"
              [disabled]="market.page() >= market.totalPages()"
              (click)="market.goToPage(market.page() + 1)"
            >
              →
            </button>
            <button
              type="button"
              class="nav"
              title="Son sayfa"
              [disabled]="market.page() >= market.totalPages()"
              (click)="market.goToPage(market.totalPages())"
            >
              »
            </button>
          </div>
        </nav>
      }
    </section>
  `,
  styles: `
    .controls {
      margin-top: 22px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Yatay kayan sekme şeridi */
    .tabs-row {
      width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      &::-webkit-scrollbar { display: none; }
    }

    .tabs {
      display: inline-flex;
      gap: 5px;
      background: var(--panel);
      border: 1px solid var(--line);
      padding: 5px;
      border-radius: 12px;
      white-space: nowrap;
      min-width: max-content;
    }

    .tab {
      border: none;
      background: transparent;
      color: var(--muted);
      font-weight: 700;
      font-size: 12px;
      padding: 7px 13px;
      border-radius: 8px;
      cursor: pointer;
      transition: 0.18s;
      white-space: nowrap;

      &:hover {
        color: var(--text);
        background: rgba(255,255,255,0.05);
      }

      &.active {
        background: var(--accent);
        color: #1a1206;
      }
    }

    .search-row {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .search {
      flex: 1;
      min-width: 200px;
      max-width: 320px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 11px 16px;
      color: var(--text);
      font-size: 13px;

      &::placeholder {
        color: var(--muted);
      }

      &:focus {
        outline: 2px solid var(--accent);
        outline-offset: -1px;
      }
    }

    .count {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
    }

    .grid {
      margin: 18px 0 16px;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }

    .pager {
      margin: 20px 0 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .pager-meta {
      font-size: 12.5px;
      color: var(--muted);
      margin: 0;

      b {
        color: var(--text);
        font-weight: 700;
      }

      .sep {
        margin: 0 6px;
        opacity: 0.5;
      }
    }

    .pager-btns {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;

      button {
        min-width: 40px;
        height: 40px;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--text);
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;

        &:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        &.cur {
          background: var(--accent);
          color: #1a1206;
          border-color: var(--accent);
        }

        &.nav {
          min-width: 44px;
        }
      }

      .dots {
        min-width: 28px;
        text-align: center;
        color: var(--muted);
        font-weight: 700;
        user-select: none;
      }
    }

    .data-note {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--line);
      border-radius: 10px;
      font-size: 11.5px;
      color: var(--muted);
      line-height: 1.5;

      b { color: var(--text); font-weight: 600; }
    }

    .status {
      margin: 24px 0;
      color: var(--muted);
      font-size: 14px;

      &.error {
        color: var(--down);
      }
    }

    .retry {
      margin-left: 10px;
      background: var(--panel2);
      border: 1px solid var(--line);
      color: var(--text);
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
    }

    @media (max-width: 1100px) {
      .grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    @media (max-width: 900px) {
      .grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 600px) {
      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
    }
  `,
})
export class MarketPageComponent implements OnInit {
  readonly market = inject(MarketService);
  private readonly modals = inject(ModalService);

  readonly tabs = INDEX_TABS;

  searchInput = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly rangeLabel = computed(() => {
    const total = this.market.serverTotalCount();
    const page = this.market.page();
    if (!total) return { from: 0, to: 0, total: 0 };

    const from = (page - 1) * MARKET_PAGE_SIZE + 1;
    const to = Math.min(page * MARKET_PAGE_SIZE, total);
    return { from, to, total };
  });

  readonly pageItems = computed(() =>
    buildPageList(this.market.page(), this.market.totalPages()),
  );

  ngOnInit(): void {
    this.market.loadMarket();
  }

  setFilter(filter: string): void {
    this.market.setFilter(filter);
  }

  onSearch(term: string): void {
    this.searchInput = term;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.market.setSearch(term.toLocaleUpperCase('tr-TR').trim());
    }, 300);
  }

  openDetail(symbol: string): void {
    this.modals.openStock(symbol);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

function buildPageList(current: number, total: number): PageItem[] {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: PageItem[] = [1];
  if (current > 3) items.push('ellipsis');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p++) items.push(p);

  if (current < total - 2) items.push('ellipsis');
  items.push(total);
  return items;
}
