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
  styles: `
    .market-switch {
      display: inline-flex;
      gap: 2px;
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 3px;
      max-width: 100%;
      /* overflow gizlenmiyor: sekmeler her genişlikte sığıyor ve butonun üstüne
         taşan "CANLI VERİ" rozetinin kırpılmaması gerekiyor. */
      margin-top: 10px;
    }
    /* Uzun etiket masaüstünde, kısa etiket dar ekranda (aşağıdaki media query) gösterilir. */
    .ms-short { display: none; }
    .ms-btn {
      position: relative;
      flex: none;
      white-space: nowrap;
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
    .ms-flag {
      flex: none;
      border-radius: 2px;
      margin-right: 4px;
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--text) 12%, transparent);
    }
    .ms-crypto-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #f7931a;
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      line-height: 1;
    }
    .live-badge {
      position: absolute;
      top: -8px;
      right: -2px;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.4px;
      line-height: 1;
      padding: 3px 6px;
      border-radius: 6px;
      background: var(--up);
      color: #fff;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
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
    /* flex-wrap: dar ekranda banner (order: 3) kendi satırına inebilsin diye şart. */
    .search-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
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
    /* Sıralama sekmeleri satırının sağındaki boş alana doğru YUKARI büyür (negatif margin-top);
       alt kenarı arama kutusuyla hizalı kalır, satırın dikey yüksekliğini artırmaz. */
    @keyframes tmGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(240, 178, 90, 0), 0 4px 14px rgba(47, 22, 96, 0.4); }
      50% { box-shadow: 0 0 0 9px rgba(240, 178, 90, 0.16), 0 6px 22px rgba(47, 22, 96, 0.55); }
    }
    @keyframes tmShine {
      0% { transform: translateX(-140%) skewX(-18deg); }
      55%, 100% { transform: translateX(260%) skewX(-18deg); }
    }
    @keyframes tmBtnPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(240, 178, 90, 0.55); }
      70% { box-shadow: 0 0 0 7px rgba(240, 178, 90, 0); }
    }
    @keyframes tmRing {
      to { transform: rotate(360deg); }
    }
    /* Ortak (3 hâlde de aynı) yerleşim. Boyut/renk/gölge her hâlin kendi bloğunda. */
    .tm-cta {
      position: relative;
      overflow: hidden;
      margin-left: auto;
      flex: 0 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: none;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    /* 'plain' — ilk/sade hâl. */
    .tm-cta.tm-plain {
      margin-top: -38px;
      max-width: 420px;
      height: 74px;
      padding: 0 14px;
      border-radius: 12px;
      background: linear-gradient(120deg, #5b2fb0, #2f1660);
      &:hover { transform: translateY(-1px); box-shadow: 0 4px 14px color-mix(in srgb, #2f1660 55%, transparent); }
      .tm-cta-text { font-size: 13px; font-weight: 700; text-shadow: none; }
      .tm-cta-btn { font-size: 11.5px; padding: 5px 14px; border-radius: 7px; box-shadow: none; }
      .tm-cta-icon svg { width: 34px; height: 34px; }
    }
    /* 'bold' ve 'animated' — büyük, çerçeveli, gölgeli ortak görünüm; animated buna hareket ekler. */
    .tm-cta.tm-bold,
    .tm-cta.tm-animated {
      margin-top: -44px;
      max-width: 440px;
      height: 86px;
      padding: 0 16px;
      border: 2px solid #f0b25a;
      border-radius: 14px;
      background:
        radial-gradient(circle at 18% 15%, rgba(255, 255, 255, 0.16), transparent 45%),
        linear-gradient(120deg, #6c34d6, #2a1454);
      box-shadow:
        0 8px 22px rgba(47, 22, 96, 0.45),
        0 0 0 4px color-mix(in srgb, #f0b25a 20%, transparent);
      &:hover {
        transform: translateY(-2px) scale(1.015);
        box-shadow:
          0 10px 26px rgba(47, 22, 96, 0.55),
          0 0 0 4px color-mix(in srgb, #f0b25a 32%, transparent);
      }
      .tm-cta-text { font-size: 15px; font-weight: 800; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); }
      .tm-cta-btn { font-size: 12.5px; padding: 6px 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(221, 149, 48, 0.5); }
      .tm-cta-icon svg { width: 40px; height: 40px; }
    }
    .tm-cta.tm-animated {
      animation: tmGlow 2.2s ease-in-out infinite;
      .tm-icon-ring { animation: tmRing 4.5s linear infinite; }
      .tm-cta-btn { animation: tmBtnPulse 1.6s ease-in-out infinite; }
    }
    .tm-shine {
      position: absolute;
      inset: 0;
      width: 40%;
      background: linear-gradient(115deg, transparent, rgba(255, 255, 255, 0.32), transparent);
      animation: tmShine 3.4s ease-in-out infinite;
      pointer-events: none;
    }
    .tm-cta-body {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 7px;
      min-width: 0;
    }
    .tm-cta-icon {
      flex: none;
      display: flex;
      align-items: center;
    }
    .tm-icon-ring {
      transform-box: fill-box;
      transform-origin: center;
    }
    .tm-cta-text {
      color: #fff;
      text-align: left;
      line-height: 1.25;
    }
    .tm-cta-btn {
      flex: none;
      font-weight: 800;
      color: #3a1f00;
      background: linear-gradient(135deg, #f0b25a, #dd9530);
    }
    /* Dar ekran: yukarı taşma (negatif margin) kalkar, banner kendi satırında tam genişlik olur. */
    @media (max-width: 900px) {
      .tm-cta.tm-plain,
      .tm-cta.tm-bold,
      .tm-cta.tm-animated {
        margin-top: 4px;
        margin-left: 0;
        width: 100%;
        max-width: 100%;
        order: 3;
        height: auto;
        min-height: 64px;
        padding: 12px 14px;
      }
      .tm-cta-text { font-size: 13.5px; }
    }
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
    /* Uzun açıklama masaüstünde; dar ekranda tek satıra sığan kısa hali. */
    .note-short { display: none; }
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
      /* Üçü de tam adıyla tek satıra sığsın: font/padding küçülür, sadece "KRİPTO
         PİYASASI" kısalır (diğer ikisi tam ad olarak kalır). */
      .ms-long { display: none; }
      .ms-short { display: inline; }
      /* overflow: visible — üçü de sığdığı için kaydırmaya gerek yok; ayrıca
         overflow gizli kalırsa butonun üstüne taşan "CANLI VERİ" rozeti kırpılıyor. */
      .market-switch { display: flex; width: 100%; overflow: visible; margin-top: 10px; }
      .ms-btn {
        flex: 1 1 0;
        justify-content: center;
        font-size: 9.5px;
        padding: 8px 4px;
        letter-spacing: 0;
        gap: 3px;
      }
      .ms-flag { width: 15px; height: 10px; margin-right: 2px; }
      .ms-crypto-badge { width: 15px; height: 15px; font-size: 10px; }

      .note-long { display: none; }
      .note-short { display: inline; white-space: nowrap; }
      .data-note { align-items: center; font-size: 11px; }
    }
    @media (max-width: 380px) {
      .ms-btn { font-size: 8.5px; padding: 8px 3px; }
    }
  `,
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
  searchFocused = false;
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
    this.searchFocused = false;
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
    this.searchFocused = true;
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
