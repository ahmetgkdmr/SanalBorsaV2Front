import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarketFilter } from '../../core/models/stock.model';
import { MarketService } from '../../core/services/market.service';
import { ModalService } from '../../core/services/modal.service';
import { StockCardComponent } from './components/stock-card/stock-card.component';

@Component({
  selector: 'app-market-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StockCardComponent],
  template: `
    <section class="page">
      <div class="controls">
        <div class="tabs" role="tablist">
          @for (tab of tabs; track tab.id) {
            <button
              class="tab"
              type="button"
              [class.active]="market.filter() === tab.id"
              (click)="setFilter(tab.id)"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        <input
          class="search"
          type="text"
          placeholder="Hisse ara (ör. THYAO)"
          [ngModel]="market.search()"
          (ngModelChange)="onSearch($event)"
        />

        <span class="count">{{ market.totalCount() }} hisse</span>
      </div>

      @if (market.loading()) {
        <p class="status">Yükleniyor…</p>
      } @else {
        <div class="grid">
          @for (card of market.cards(); track card.symbol) {
            <app-stock-card [stock]="card" (selected)="openDetail($event)" />
          }
        </div>
      }
    </section>
  `,
  styles: `
    .controls {
      margin-top: 22px;
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .tabs {
      display: flex;
      gap: 6px;
      background: var(--panel);
      border: 1px solid var(--line);
      padding: 5px;
      border-radius: 12px;
    }

    .tab {
      border: none;
      background: transparent;
      color: var(--muted);
      font-weight: 700;
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: 0.18s;

      &:hover {
        color: var(--text);
      }

      &.active {
        background: var(--accent);
        color: #1a1206;
      }
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
      margin-left: auto;
    }

    .grid {
      margin: 18px 0 40px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 12px;
    }

    .status {
      margin: 24px 0;
      color: var(--muted);
      font-size: 14px;

      &.error {
        color: var(--down);
      }
    }

    @media (max-width: 600px) {
      .grid {
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 10px;
      }
    }
  `,
})
export class MarketPageComponent implements OnInit {
  readonly market = inject(MarketService);
  private readonly modals = inject(ModalService);

  readonly tabs: { id: MarketFilter; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'b30', label: 'BIST 30' },
    { id: 'b50', label: 'BIST 50' },
    { id: 'b100', label: 'BIST 100' },
  ];

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.market.loadMarket();
  }

  setFilter(filter: MarketFilter): void {
    this.market.setFilter(filter);
  }

  onSearch(term: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.market.setSearch(term.toLocaleUpperCase('tr-TR').trim());
    }, 300);
  }

  openDetail(symbol: string): void {
    this.modals.openStock(symbol);
  }
}
