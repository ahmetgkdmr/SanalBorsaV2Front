import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { INDEX_TABS } from '../../core/constants/bist-tiers';
import { StockCardView } from '../../core/models/stock.model';
import { MARKET_PAGE_SIZE, MarketService, MarketSortKey } from '../../core/services/market.service';
import {
  CRYPTO_PAGE_SIZE,
  CryptoMarketService,
  CryptoSortKey,
} from '../../core/services/crypto-market.service';
import { US_PAGE_SIZE, UsMarketService, UsSortKey } from '../../core/services/us-market.service';
import { MarketTypeService } from '../../core/services/market-type.service';
import { ModalService } from '../../core/services/modal.service';
import { formatCryptoPrice, formatNumber } from '../../core/utils/format.util';
import { StockCardComponent } from './components/stock-card/stock-card.component';
import { TopGainersCrownComponent } from './components/top-gainers-crown/top-gainers-crown.component';

type PageItem = number | 'ellipsis';

const SORT_OPTIONS: { key: MarketSortKey & CryptoSortKey & UsSortKey; label: string }[] = [
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
          <svg class="ms-flag" viewBox="0 0 3 2" width="18" height="12" aria-hidden="true">
            <rect width="3" height="2" fill="#E30A17" />
            <circle cx="1.1" cy="1" r="0.5" fill="#fff" />
            <circle cx="1.25" cy="1" r="0.4" fill="#E30A17" />
            <polygon
              points="1.5,0.62 1.58,0.86 1.83,0.86 1.62,1 1.7,1.24 1.5,1.1 1.3,1.24 1.38,1 1.17,0.86 1.42,0.86"
              fill="#fff"
            />
          </svg>
          <span class="ms-label">BORSA İSTANBUL</span>
        </button>
        <button
          type="button"
          class="ms-btn ms-crypto"
          [class.active]="marketType.type() === 'crypto'"
          (click)="setMarket('crypto')"
        >
          <span class="ms-flag ms-crypto-badge" aria-hidden="true">₿</span>
          <span class="ms-long">KRİPTO PİYASASI</span><span class="ms-short">KRİPTO</span>

          <span class="live-badge" title="Binance spot canlı veri">CANLI VERİ</span>
        </button>
        <button
          type="button"
          class="ms-btn"
          [class.active]="marketType.type() === 'us'"
          (click)="setMarket('us')"
        >
          <svg class="ms-flag" viewBox="0 0 3 2" width="18" height="12" aria-hidden="true">
            <rect width="3" height="2" fill="#B22234" />
            <rect y="0.1538" width="3" height="0.1538" fill="#fff" />
            <rect y="0.4615" width="3" height="0.1538" fill="#fff" />
            <rect y="0.7692" width="3" height="0.1538" fill="#fff" />
            <rect y="1.0769" width="3" height="0.1538" fill="#fff" />
            <rect y="1.3846" width="3" height="0.1538" fill="#fff" />
            <rect y="1.6923" width="3" height="0.1538" fill="#fff" />
            <rect width="1.2" height="1.0769" fill="#3C3B6E" />
          </svg>
          <span class="ms-label">ABD HİSSELERİ</span>
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
                  : marketType.type() === 'us'
                    ? 'Hisse ara (ör. AAPL)'
                    : 'Hisse ara (ör. THYAO)'
              "
              [ngModel]="searchInput"
              (ngModelChange)="onSearch($event)"
              (focus)="searchFocused.set(true)"
              (blur)="onSearchBlur()"
              (keydown.arrowDown)="onSuggestNav($event, 1)"
              (keydown.arrowUp)="onSuggestNav($event, -1)"
              (keydown.enter)="onSuggestEnter($event)"
              (keydown.escape)="searchFocused.set(false)"
              autocomplete="off"
              spellcheck="false"
            />
            @if (marketType.type() === 'crypto' && searchFocused() && crypto.suggestions().length) {
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
            } @else if (marketType.type() === 'us') {
              {{ us.serverTotalCount() }} hisse
            } @else {
              {{ market.serverTotalCount() }} hisse
            }
          </span>

          <button
            class="tm-cta"
            [class.tm-plain]="tmCtaStyle === 'plain'"
            [class.tm-bold]="tmCtaStyle === 'bold'"
            [class.tm-animated]="tmCtaStyle === 'animated'"
            type="button"
            (click)="modals.open('dailyReport')"
          >
            @if (tmCtaStyle === 'animated') {
              <span class="tm-shine" aria-hidden="true"></span>
            }
            <span class="tm-cta-body">
              <span class="tm-cta-text">10 yıl önce 1000 ₺ ye ne alsam zengindim?</span>
              <span class="tm-cta-btn">{{ tmCtaStyle === 'plain' ? 'Dene!' : 'Hemen Dene!' }}</span>
            </span>
            <span class="tm-cta-icon">
              <svg viewBox="0 0 48 48" fill="none">
                <path
                  class="tm-icon-ring"
                  d="M24 6a18 18 0 1 1 -12.73 5.27"
                  stroke="#e3a458"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-dasharray="1.5 6"
                />
                <path
                  d="M10.5 4.5v7.5h7.5"
                  stroke="#e3a458"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  fill="none"
                />
                <circle cx="24" cy="24" r="13" fill="none" stroke="#fff" stroke-width="2.5" />
                <path d="M24 17v7l5 3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      @if (marketType.type() === 'bist') {
        <app-top-gainers-crown marketType="bist" />

        @if (market.dataAsOf()) {
          <div class="data-note">
            <span>ℹ️</span>
            <span class="note-long">
              Fiyatlar <b>{{ formatDate(market.dataAsOf()!) }}</b> tarihli son kapanış verilerini içermektedir.
              Sırala: <b>{{ sortLabel() }}</b>
            </span>
            <span class="note-short">
              <b>{{ formatDate(market.dataAsOf()!) }}</b> kapanışı · <b>{{ sortLabel() }}</b>
            </span>
          </div>
        }
      } @else if (marketType.type() === 'crypto') {
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
      } @else {
        <app-top-gainers-crown marketType="us" />

        <div class="data-note">
          <span>🇺🇸</span>
          <span>
            <b>S&amp;P 500</b> — günlük kapanış verisi
            · sırala: <b>{{ sortLabel() }}</b>
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
  styleUrl: './market.page.css',
})
export class MarketPageComponent implements OnInit, OnDestroy {
  readonly market = inject(MarketService);
  readonly crypto = inject(CryptoMarketService);
  readonly us = inject(UsMarketService);
  readonly marketType = inject(MarketTypeService);
  readonly modals = inject(ModalService);

  /** Zaman Makinesi CTA'sı — 3 görsel hâl saklanıyor, tek kelimeyle değiştirilebilir:
   * 'plain' = ilk/sade hâl, 'bold' = büyük+çerçeveli statik hâl, 'animated' = parıltılı/hareketli hâl. */
  readonly tmCtaStyle: 'plain' | 'bold' | 'animated' = 'bold';

  readonly tabs = INDEX_TABS;
  readonly sortOptions = SORT_OPTIONS;
  searchInput = '';
  /** Signal: setTimeout içinde de değişiyor; düz alan olsaydı zoneless'ta arayüz güncellenmezdi. */
  readonly searchFocused = signal(false);
  suggestIndex = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly isLoading = computed(() => {
    const kind = this.marketType.type();
    if (kind === 'crypto') return this.crypto.loading();
    if (kind === 'us') return this.us.loading();
    return this.market.loading();
  });

  readonly activeSortKey = computed(() => {
    const kind = this.marketType.type();
    if (kind === 'crypto') return this.crypto.sortKey();
    if (kind === 'us') return this.us.sortKey();
    return this.market.sortKey();
  });

  readonly activeSortDesc = computed(() => {
    const kind = this.marketType.type();
    if (kind === 'crypto') return this.crypto.sortDesc();
    if (kind === 'us') return this.us.sortDesc();
    return this.market.sortDesc();
  });

  readonly errorMsg = computed(() => {
    const kind = this.marketType.type();
    if (kind === 'crypto') return this.crypto.error();
    if (kind === 'us') return this.us.error();
    return this.market.error();
  });

  readonly displayCards = computed<StockCardView[]>(() => {
    const kind = this.marketType.type();
    if (kind === 'bist') return this.market.cards();
    if (kind === 'us') return this.us.cards();
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

  readonly activePage = computed(() => {
    const kind = this.marketType.type();
    if (kind === 'crypto') return this.crypto.page();
    if (kind === 'us') return this.us.page();
    return this.market.page();
  });

  readonly activeTotalPages = computed(() => {
    const kind = this.marketType.type();
    if (kind === 'crypto') return this.crypto.totalPages();
    if (kind === 'us') return this.us.totalPages();
    return this.market.totalPages();
  });

  readonly activeRange = computed(() => {
    const kind = this.marketType.type();
    if (kind === 'crypto') {
      const total = this.crypto.totalCount();
      const page = this.crypto.page();
      if (!total) return { from: 0, to: 0, total: 0 };
      const from = (page - 1) * CRYPTO_PAGE_SIZE + 1;
      const to = Math.min(page * CRYPTO_PAGE_SIZE, total);
      return { from, to, total };
    }
    if (kind === 'us') {
      const total = this.us.serverTotalCount();
      const page = this.us.page();
      if (!total) return { from: 0, to: 0, total: 0 };
      const from = (page - 1) * US_PAGE_SIZE + 1;
      const to = Math.min(page * US_PAGE_SIZE, total);
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

  setSort(key: MarketSortKey & CryptoSortKey & UsSortKey): void {
    const kind = this.marketType.type();
    if (kind === 'crypto') this.crypto.setSort(key);
    else if (kind === 'us') this.us.setSort(key);
    else this.market.setSort(key);
  }

  ngOnInit(): void {
    const kind = this.marketType.type();
    if (kind === 'crypto') this.crypto.load();
    else if (kind === 'us') this.us.loadMarket();
    else this.market.loadMarket();
  }

  ngOnDestroy(): void {
    // crypto.stopPolling() burada ÇAĞRILMIYOR: aynı SignalR hub'ı header'daki
    // canlı USD/EUR/gram altın şeridi de kullanıyor (bkz. market-ticker.component.ts),
    // o şerit her sayfada sabit — bağlantıyı kesersek orası da donuyor.
  }

  setMarket(type: 'bist' | 'crypto' | 'us'): void {
    this.marketType.setType(type);
    this.searchInput = '';
    this.searchFocused.set(false);
    this.suggestIndex = 0;
    if (type === 'crypto') {
      this.crypto.setSearch('');
      this.crypto.load();
    } else if (type === 'us') {
      this.us.setSearch('');
      if (!this.us.symbolOptions().length) this.us.loadMarket();
    } else {
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
    const kind = this.marketType.type();
    if (kind === 'crypto') this.crypto.goToPage(p);
    else if (kind === 'us') this.us.goToPage(p);
    else this.market.goToPage(p);
  }

  onSearch(term: string): void {
    this.searchInput = term;
    this.suggestIndex = 0;
    this.searchFocused.set(true);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      const kind = this.marketType.type();
      if (kind === 'crypto') {
        this.crypto.setSearch(term);
      } else if (kind === 'us') {
        this.us.setSearch(term.toUpperCase().trim());
      } else {
        this.market.setSearch(term.toLocaleUpperCase('tr-TR').trim());
      }
    }, 180);
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.searchFocused.set(false);
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
    this.searchFocused.set(false);
    this.openDetail(symbol);
  }

  fmtPrice(value: number, decimals?: number): string {
    return formatCryptoPrice(value, decimals);
  }

  fmtPct(value: number): string {
    return formatNumber(value, 2);
  }

  reload(): void {
    const kind = this.marketType.type();
    if (kind === 'crypto') this.crypto.load();
    else if (kind === 'us') this.us.reloadMarket();
    else this.market.reloadMarket();
  }

  openDetail(symbol: string): void {
    const kind = this.marketType.type();
    if (kind === 'crypto') this.modals.openCrypto(symbol);
    else if (kind === 'us') this.modals.openUsStock(symbol);
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
