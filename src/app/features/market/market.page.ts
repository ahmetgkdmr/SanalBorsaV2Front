import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { INDEX_TABS } from '../../core/constants/bist-tiers';
import { StockCardView } from '../../core/models/stock.model';
import { MARKET_PAGE_SIZE, MarketService, MarketSortKey } from '../../core/services/market.service';
import {
  CRYPTO_PAGE_SIZE,
  CryptoMarketService,
  CryptoSortKey,
} from '../../core/services/crypto-market.service';
import { MarketTypeService } from '../../core/services/market-type.service';
import { ModalService } from '../../core/services/modal.service';
import { formatCryptoPrice, formatNumber } from '../../core/utils/format.util';
import { StockCardComponent } from './components/stock-card/stock-card.component';
import { TopGainersCrownComponent } from './components/top-gainers-crown/top-gainers-crown.component';

type PageItem = number | 'ellipsis';

const SORT_OPTIONS: { key: MarketSortKey & CryptoSortKey; label: string }[] = [
  { key: 'volume', label: 'Hacim' },
  { key: 'price', label: 'Fiyat' },
  { key: 'change', label: 'Değişim %' },
  { key: 'name', label: 'İsim' },
];

@Component({
  selector: 'app-market-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StockCardComponent, TopGainersCrownComponent],
  template: `
    <section class="page">
      <div class="market-switch" role="tablist" aria-label="Piyasa seçimi">
        <button
          type="button"
          class="ms-btn"
          [class.active]="marketType.type() === 'bist'"
          (click)="setMarket('bist')"
        >
          BORSA İSTANBUL
        </button>
        <button
          type="button"
          class="ms-btn ms-crypto"
          [class.active]="marketType.type() === 'crypto'"
          (click)="setMarket('crypto')"
        >
          KRİPTO PİYASASI
          <span class="live-badge" title="Binance spot canlı veri">CANLI VERİ</span>
        </button>
      </div>

      <div class="controls">
        @if (marketType.type() === 'bist') {
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
        }

        <div class="tabs-row">
          <div class="tabs sort-tabs" role="group" aria-label="Sıralama">
            @for (s of sortOptions; track s.key) {
              <button
                class="tab"
                type="button"
                [class.active]="activeSortKey() === s.key"
                (click)="setSort(s.key)"
              >
                {{ s.label }}
                @if (activeSortKey() === s.key) {
                  <span class="sort-arrow">{{ activeSortDesc() ? '↓' : '↑' }}</span>
                }
              </button>
            }
          </div>
        </div>

        <div class="search-row">
          <div class="search-wrap">
            <input
              class="search"
              type="text"
              [placeholder]="
                marketType.type() === 'crypto'
                  ? 'Coin ara (BTC, ETH, SOL…)'
                  : 'Hisse ara (ör. THYAO)'
              "
              [ngModel]="searchInput"
              (ngModelChange)="onSearch($event)"
              (focus)="searchFocused = true"
              (blur)="onSearchBlur()"
              (keydown.arrowDown)="onSuggestNav($event, 1)"
              (keydown.arrowUp)="onSuggestNav($event, -1)"
              (keydown.enter)="onSuggestEnter($event)"
              (keydown.escape)="searchFocused = false"
              autocomplete="off"
              spellcheck="false"
            />
            @if (marketType.type() === 'crypto' && searchFocused && crypto.suggestions().length) {
              <ul class="suggest" role="listbox">
                @for (s of crypto.suggestions(); track s.symbol; let i = $index) {
                  <li
                    role="option"
                    [class.active]="i === suggestIndex"
                    (mousedown)="pickSuggestion(s.symbol)"
                  >
                    <span class="sg-pair">
                      <b>{{ s.baseAsset }}</b><span class="quote">/USDT</span>
                    </span>
                    <span class="sg-price mono">{{ fmtPrice(s.price, s.priceDecimals) }}</span>
                    <span
                      class="sg-chg mono"
                      [class.up]="s.changePercent24h >= 0"
                      [class.down]="s.changePercent24h < 0"
                    >
                      {{ s.changePercent24h >= 0 ? '+' : '' }}{{ fmtPct(s.changePercent24h) }}%
                    </span>
                  </li>
                }
              </ul>
            }
          </div>
          <span class="count">
            @if (marketType.type() === 'crypto') {
              {{ crypto.totalCount() }} / {{ crypto.tickersCount() }} coin
            } @else {
              {{ market.serverTotalCount() }} hisse
            }
          </span>
        </div>
      </div>

      @if (marketType.type() === 'bist') {
        <app-top-gainers-crown marketType="bist" />

        @if (market.dataAsOf()) {
          <div class="data-note">
            <span>ℹ️</span>
            <span>
              Fiyatlar <b>{{ formatDate(market.dataAsOf()!) }}</b> tarihli son kapanış verilerini içermektedir.
              Sırala: <b>{{ sortLabel() }}</b> · grafikler son 28 günlük kapanışa göre.
            </span>
          </div>
        }
      } @else {
        <app-top-gainers-crown marketType="crypto" />

        <div class="data-note">
          <span>⚡</span>
          <span>
            Binance spot USDT
            @if (crypto.live()) {
              · <b>canlı</b>
            } @else {
              · bağlanıyor…
            }
            · sırala: <b>{{ sortLabel() }}</b>
            · başlangıç <b>100.000 USD</b>
          </span>
        </div>
      }

      @if (isLoading()) {
        <p class="status">Yükleniyor…</p>
      } @else if (errorMsg()) {
        <p class="status error">
          {{ errorMsg() }}
          <button class="retry" type="button" (click)="reload()">Tekrar dene</button>
        </p>
      } @else {
        <div class="grid">
          @for (card of displayCards(); track card.symbol) {
            <app-stock-card [stock]="card" (selected)="openDetail($event)" />
          }
        </div>

        @if (!displayCards().length) {
          <p class="status">
            {{ marketType.type() === 'crypto' ? 'Eşleşen coin yok.' : 'Bu sayfada gösterilecek kayıt yok.' }}
          </p>
        }

        <nav class="pager" [attr.aria-label]="marketType.type() === 'crypto' ? 'Coin sayfaları' : 'Hisse sayfaları'">
          <p class="pager-meta mono">
            <span>{{ activeRange().from }}–{{ activeRange().to }}</span>
            / {{ activeRange().total }}
            {{ marketType.type() === 'crypto' ? 'coin' : 'hisse' }}
            <span class="sep">·</span>
            Sayfa <b>{{ activePage() }}</b> / <b>{{ activeTotalPages() }}</b>
          </p>

          <div class="pager-btns">
            <button type="button" class="nav" [disabled]="activePage() === 1" (click)="goFirst()">«</button>
            <button type="button" class="nav" [disabled]="activePage() === 1" (click)="goPrev()">←</button>
            @for (item of activePageItems(); track $index) {
              @if (item === 'ellipsis') {
                <span class="dots">…</span>
              } @else {
                <button type="button" [class.cur]="item === activePage()" (click)="goPage(item)">{{ item }}</button>
              }
            }
            <button type="button" class="nav" [disabled]="activePage() >= activeTotalPages()" (click)="goNext()">→</button>
            <button type="button" class="nav" [disabled]="activePage() >= activeTotalPages()" (click)="goLast()">»</button>
          </div>
        </nav>
      }
    </section>
  `,
  styles: `
    .market-switch {
      margin-top: 20px;
      display: inline-flex;
      gap: 2px;
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 3px;
    }
    .ms-btn {
      position: relative;
      border: none;
      background: transparent;
      color: var(--muted);
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.3px;
      padding: 9px 14px;
      border-radius: 8px;
      cursor: pointer;
      transition: color 0.15s, background 0.15s;
      &.active {
        background: var(--accent);
        color: #0b1220;
      }
      &:not(.active):hover {
        color: var(--text);
        background: var(--chip-hover);
      }
    }
    .ms-crypto {
      padding-right: 18px;
    }
    .live-badge {
      position: absolute;
      top: -7px;
      right: -2px;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.4px;
      line-height: 1;
      padding: 3px 6px;
      border-radius: 6px;
      background: var(--up);
      color: #04180f;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
    .controls {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .tabs-row {
      width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      &::-webkit-scrollbar { display: none; }
    }
    .tabs {
      display: inline-flex;
      gap: 4px;
      background: transparent;
      border: none;
      padding: 0;
      border-radius: 0;
      white-space: nowrap;
      min-width: max-content;
    }
    .tabs:not(.sort-tabs) {
      gap: 6px;
      padding-bottom: 0;
      border-bottom: none;
    }
    .tab {
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted);
      font-weight: 600;
      font-size: 12px;
      padding: 7px 12px;
      border-radius: 100px;
      cursor: pointer;
      transition: color 0.15s, background 0.15s, border-color 0.15s;
      white-space: nowrap;
      &:hover {
        color: var(--text);
        background: var(--chip-hover);
      }
      &.active {
        background: var(--panel);
        border-color: var(--accent);
        color: var(--text);
        font-weight: 700;
        box-shadow: none;
      }
    }
    :host-context([data-theme='dark']) .tab.active {
      background: color-mix(in srgb, var(--accent) 12%, var(--panel));
      border-color: var(--accent);
      color: var(--text);
    }
    .sort-tabs {
      gap: 4px;
      .tab {
        font-size: 11.5px;
        font-weight: 600;
        padding: 6px 11px;
        border: 1px solid transparent;
        border-radius: 100px;
        &.active {
          background: var(--panel);
          border-color: var(--accent);
          box-shadow: none;
          color: var(--text);
          font-weight: 700;
          border-radius: 100px;
        }
      }
    }
    .sort-arrow {
      margin-left: 3px;
      font-weight: 700;
      opacity: 0.75;
    }
    .search-row { display: flex; gap: 10px; align-items: flex-start; }
    .search-wrap {
      position: relative;
      flex: 1;
      min-width: 200px;
      max-width: 400px;
    }
    .search {
      width: 100%;
      box-sizing: border-box;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 14px;
      color: var(--text);
      font-size: 13px;
      transition: border-color 0.15s;
      &::placeholder { color: var(--muted); }
      &:focus {
        outline: none;
        border-color: color-mix(in srgb, var(--accent) 65%, var(--line));
      }
    }
    .suggest {
      position: absolute;
      z-index: 40;
      left: 0; right: 0; top: calc(100% + 4px);
      margin: 0; padding: 4px;
      list-style: none;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      box-shadow: var(--shadow);
      max-height: 320px;
      overflow: auto;
    }
    .suggest li {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 12px;
      align-items: center;
      padding: 9px 11px;
      border-radius: 7px;
      cursor: pointer;
      font-size: 13px;
      &:hover, &.active { background: var(--chip-hover); }
    }
    .sg-pair .quote { color: var(--muted); font-weight: 500; margin-left: 1px; }
    .sg-price { color: var(--text); }
    .sg-chg.up { color: var(--up); }
    .sg-chg.down { color: var(--down); }
    .count { font-size: 12px; color: var(--muted); white-space: nowrap; padding-top: 11px; }
    .grid {
      margin: 16px 0 14px;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      align-items: stretch;
    }
    .mono { font-variant-numeric: tabular-nums; }
    .pager {
      margin: 18px 0 36px;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
    }
    .pager-meta {
      font-size: 12px; color: var(--muted); margin: 0;
      b { color: var(--text); font-weight: 700; }
      .sep { margin: 0 6px; opacity: 0.45; }
    }
    .pager-btns {
      display: flex; gap: 4px; align-items: center; flex-wrap: wrap; justify-content: center;
      button {
        min-width: 36px; height: 36px; border-radius: 8px;
        border: 1px solid var(--line); background: transparent;
        color: var(--text); font-weight: 600; font-size: 13px; cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        &:hover:not(:disabled):not(.cur) { background: var(--chip-hover); }
        &:disabled { opacity: 0.35; cursor: not-allowed; }
        &.cur {
          background: var(--accent);
          color: #1a1206;
          border-color: var(--accent);
          font-weight: 700;
        }
        &.nav { min-width: 40px; }
      }
      .dots { min-width: 24px; text-align: center; color: var(--muted); font-weight: 600; }
    }
    .data-note {
      display: flex; align-items: flex-start; gap: 8px; margin-top: 8px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 0;
      font-size: 11.5px; color: var(--muted); line-height: 1.45;
      b { color: var(--text); font-weight: 600; }
    }
    .status {
      margin: 24px 0; color: var(--muted); font-size: 14px;
      &.error { color: var(--down); }
    }
    .retry {
      margin-left: 10px; background: transparent; border: 1px solid var(--line);
      color: var(--text); border-radius: 8px; padding: 6px 12px;
      cursor: pointer; font-size: 12px; font-weight: 600;
    }
    @media (max-width: 1100px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    @media (max-width: 900px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 600px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .ms-btn { font-size: 11px; padding: 8px 10px; }
    }
  `,
})
export class MarketPageComponent implements OnInit, OnDestroy {
  readonly market = inject(MarketService);
  readonly crypto = inject(CryptoMarketService);
  readonly marketType = inject(MarketTypeService);
  private readonly modals = inject(ModalService);

  readonly tabs = INDEX_TABS;
  readonly sortOptions = SORT_OPTIONS;
  searchInput = '';
  searchFocused = false;
  suggestIndex = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly isLoading = computed(() =>
    this.marketType.type() === 'crypto' ? this.crypto.loading() : this.market.loading(),
  );

  readonly activeSortKey = computed(() =>
    this.marketType.type() === 'crypto' ? this.crypto.sortKey() : this.market.sortKey(),
  );

  readonly activeSortDesc = computed(() =>
    this.marketType.type() === 'crypto' ? this.crypto.sortDesc() : this.market.sortDesc(),
  );
  readonly errorMsg = computed(() =>
    this.marketType.type() === 'crypto' ? this.crypto.error() : this.market.error(),
  );

  readonly displayCards = computed<StockCardView[]>(() => {
    if (this.marketType.type() === 'bist') return this.market.cards();
    return this.crypto.cards().map((c) => ({
      id: 0,
      symbol: c.symbol,
      name: c.name,
      sector: null,
      industry: null,
      currency: 'USD',
      exchange: 'CRYPTO',
      isActive: true,
      earliestDataDate: null,
      latestDataDate: null,
      needsHistoryRefresh: false,
      close: c.close,
      open: c.close,
      changePct: c.changePct,
      sparkline: [],
      volume: c.volume,
      color: c.color,
      tierBadge: 'CRYPTO',
      tickUp: c.tickUp,
      priceDecimals: c.priceDecimals,
      crownLabel: c.crownLabel,
      crownPeriod: c.crownPeriod,
      crownReturnPct: c.crownReturnPct,
    }));
  });

  readonly activePage = computed(() =>
    this.marketType.type() === 'crypto' ? this.crypto.page() : this.market.page(),
  );

  readonly activeTotalPages = computed(() =>
    this.marketType.type() === 'crypto' ? this.crypto.totalPages() : this.market.totalPages(),
  );

  readonly activeRange = computed(() => {
    if (this.marketType.type() === 'crypto') {
      const total = this.crypto.totalCount();
      const page = this.crypto.page();
      if (!total) return { from: 0, to: 0, total: 0 };
      const from = (page - 1) * CRYPTO_PAGE_SIZE + 1;
      const to = Math.min(page * CRYPTO_PAGE_SIZE, total);
      return { from, to, total };
    }
    const total = this.market.serverTotalCount();
    const page = this.market.page();
    if (!total) return { from: 0, to: 0, total: 0 };
    const from = (page - 1) * MARKET_PAGE_SIZE + 1;
    const to = Math.min(page * MARKET_PAGE_SIZE, total);
    return { from, to, total };
  });

  readonly activePageItems = computed(() =>
    buildPageList(this.activePage(), this.activeTotalPages()),
  );

  readonly sortLabel = computed(() => {
    const key = this.activeSortKey();
    const label = SORT_OPTIONS.find((s) => s.key === key)?.label ?? key;
    return `${label} ${this.activeSortDesc() ? '↓' : '↑'}`;
  });

  setSort(key: MarketSortKey & CryptoSortKey): void {
    if (this.marketType.type() === 'crypto') this.crypto.setSort(key);
    else this.market.setSort(key);
  }

  ngOnInit(): void {
    if (this.marketType.type() === 'crypto') this.crypto.load();
    else this.market.loadMarket();
  }

  ngOnDestroy(): void {
    this.crypto.stopPolling();
  }

  setMarket(type: 'bist' | 'crypto'): void {
    this.marketType.setType(type);
    this.searchInput = '';
    this.searchFocused = false;
    this.suggestIndex = 0;
    if (type === 'crypto') {
      this.crypto.setSearch('');
      this.crypto.load();
    } else {
      this.crypto.stopPolling();
      this.market.setSearch('');
      this.market.loadMarket();
    }
  }

  setFilter(filter: string): void {
    this.market.setFilter(filter);
  }

  goFirst(): void {
    this.goPage(1);
  }
  goPrev(): void {
    this.goPage(this.activePage() - 1);
  }
  goNext(): void {
    this.goPage(this.activePage() + 1);
  }
  goLast(): void {
    this.goPage(this.activeTotalPages());
  }
  goPage(p: number): void {
    if (this.marketType.type() === 'crypto') this.crypto.goToPage(p);
    else this.market.goToPage(p);
  }

  onSearch(term: string): void {
    this.searchInput = term;
    this.suggestIndex = 0;
    this.searchFocused = true;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      if (this.marketType.type() === 'crypto') {
        this.crypto.setSearch(term);
      } else {
        this.market.setSearch(term.toLocaleUpperCase('tr-TR').trim());
      }
    }, 180);
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.searchFocused = false;
    }, 150);
  }

  onSuggestNav(ev: Event, delta: number): void {
    if (this.marketType.type() !== 'crypto') return;
    const n = this.crypto.suggestions().length;
    if (!n) return;
    ev.preventDefault();
    this.suggestIndex = (this.suggestIndex + delta + n) % n;
  }

  onSuggestEnter(ev: Event): void {
    if (this.marketType.type() !== 'crypto') return;
    const list = this.crypto.suggestions();
    if (!list.length) return;
    ev.preventDefault();
    const pick = list[this.suggestIndex] ?? list[0];
    this.pickSuggestion(pick.symbol);
  }

  pickSuggestion(symbol: string): void {
    const base = symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
    this.searchInput = base;
    this.crypto.setSearch(base);
    this.searchFocused = false;
    this.openDetail(symbol);
  }

  fmtPrice(value: number, decimals?: number): string {
    return formatCryptoPrice(value, decimals);
  }

  fmtPct(value: number): string {
    return formatNumber(value, 2);
  }

  reload(): void {
    if (this.marketType.type() === 'crypto') this.crypto.load();
    else this.market.reloadMarket();
  }

  openDetail(symbol: string): void {
    if (this.marketType.type() === 'crypto') this.modals.openCrypto(symbol);
    else this.modals.openStock(symbol);
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
