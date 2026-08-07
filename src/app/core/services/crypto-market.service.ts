import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CryptoCardView, CryptoTicker } from '../models/crypto.model';
import { symbolColor } from '../utils/format.util';
import { CryptoApiService } from './crypto-api.service';
import { StockApiService } from './stock-api.service';

export const CRYPTO_PAGE_SIZE = 50;

/**
 * Kripto kartı değil, canlı forex/emtia göstergeleri — coin listelerinde gizlenir.
 * Backend'de TradingView'ın gerçek quote akışından (FX_IDC:USDTRY/EURTRY/XAUTRY) geliyor,
 * TL bazlı fiyat zaten hazır (gram altın da backend'de bölünmüş halde) — burada türetme yok.
 */
const FX_SYMBOLS = new Set(['USDTRY', 'EURTRY', 'GRAMALTIN']);

export interface FxQuote {
  value: number;
  changePct: number;
}

/** Binance Markets benzeri sıralama alanları */
export type CryptoSortKey = 'volume' | 'price' | 'change' | 'name';

interface CrownInfo {
  label: string;
  period: string;
  returnPct: number;
}

@Injectable({ providedIn: 'root' })
export class CryptoMarketService {
  private readonly api = inject(CryptoApiService);
  private readonly stockApi = inject(StockApiService);
  private readonly zone = inject(NgZone);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly search = signal('');
  readonly live = signal(false);
  readonly page = signal(1);
  readonly sortKey = signal<CryptoSortKey>('volume');
  /** true = azalan (Binance varsayılanı hacim için) */
  readonly sortDesc = signal(true);

  private readonly tickers = signal<CryptoTicker[]>([]);
  /** Sticky tick direction: 1 = up, -1 = down (last non-zero move). */
  private readonly tickDir = signal<Record<string, 1 | -1>>({});
  /** Dönem şampiyonu sembol → taç bilgisi */
  private readonly champions = signal<Map<string, CrownInfo>>(new Map());

  private hub: signalR.HubConnection | null = null;
  private hubStarting = false;

  /** FX pariteleri kripto kartı değil, portföy/header'daki anlık kur göstergelerinin kaynağı. */
  readonly usdTryRate = computed(() => this.fxQuote('USDTRY')?.value ?? null);

  readonly usdTry = computed<FxQuote | null>(() => this.fxQuote('USDTRY'));
  readonly eurTry = computed<FxQuote | null>(() => this.fxQuote('EURTRY'));
  readonly gramAltin = computed<FxQuote | null>(() => this.fxQuote('GRAMALTIN'));

  private fxQuote(symbol: string): FxQuote | null {
    const t = this.tickers().find((x) => x.symbol === symbol);
    return t ? { value: t.price, changePct: t.changePercent24h } : null;
  }

  readonly filtered = computed<CryptoTicker[]>(() => {
    const q = this.search().trim().toUpperCase();
    const list = this.tickers().filter((t) => !FX_SYMBOLS.has(t.symbol));
    const filtered = !q
      ? list
      : list.filter(
          (t) =>
            t.symbol.includes(q) ||
            t.baseAsset.includes(q) ||
            `${t.baseAsset}/USDT`.includes(q) ||
            `${t.baseAsset}USDT`.includes(q),
        );

    return sortTickers(filtered, this.sortKey(), this.sortDesc());
  });

  /** Arama kutusu altında öneriler (prefix / includes, max 8). */
  readonly suggestions = computed(() => {
    const q = this.search().trim().toUpperCase();
    if (q.length < 1) return [] as CryptoTicker[];
    const scored = this.tickers()
      .map((t) => {
        const base = t.baseAsset.toUpperCase();
        const sym = t.symbol.toUpperCase();
        let score = 0;
        if (base === q || sym === q || sym === `${q}USDT`) score = 100;
        else if (base.startsWith(q) || sym.startsWith(q)) score = 80;
        else if (base.includes(q) || sym.includes(q)) score = 40;
        else return null;
        return { t, score };
      })
      .filter((x): x is { t: CryptoTicker; score: number } => x != null)
      .sort((a, b) => b.score - a.score || b.t.quoteVolume24h - a.t.quoteVolume24h)
      .slice(0, 8)
      .map((x) => x.t);
    return scored;
  });

  readonly tickersCount = computed(() => this.tickers().length);

  readonly totalCount = computed(() => this.filtered().length);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalCount() / CRYPTO_PAGE_SIZE) || 1),
  );

  readonly cards = computed<CryptoCardView[]>(() => {
    const dirs = this.tickDir();
    const crowns = this.champions();
    const page = this.page();
    const start = (page - 1) * CRYPTO_PAGE_SIZE;
    return this.filtered()
      .slice(start, start + CRYPTO_PAGE_SIZE)
      .map((t) => toCard(t, dirs, crowns.get(t.symbol)));
  });

  readonly priceMap = computed(() => {
    const m: Record<string, number> = {};
    for (const t of this.tickers()) m[t.symbol] = t.price;
    return m;
  });

  /** Header şeridi: hacme göre en popüler N coin (canlı). */
  readonly topByVolume = computed(() =>
    sortTickers(this.tickers().filter((t) => !FX_SYMBOLS.has(t.symbol)), 'volume', true).slice(0, 20),
  );

  /** Sembol → canlı ticker (şerit gibi sabit listeler için). */
  readonly tickerMap = computed(() => {
    const m = new Map<string, CryptoTicker>();
    for (const t of this.tickers()) m.set(t.symbol, t);
    return m;
  });

  /** İlk REST snapshot + SignalR canlı akış + dönem şampiyonları. */
  load(): void {
    this.fetchSnapshot(true);
    this.loadChampions();
    void this.startHub();
  }

  private loadChampions(): void {
    this.stockApi.getTopGainers('crypto').subscribe({
      next: (res) => {
        const map = new Map<string, CrownInfo>();
        for (const item of res.items ?? []) {
          const sym = item.symbol.toUpperCase();
          // Aynı sembol birden fazla dönem kazandıysa en kısa dönem öncelikli
          if (map.has(sym)) continue;
          map.set(sym, {
            label: item.periodLabel,
            period: item.period,
            returnPct: item.returnPct,
          });
        }
        this.champions.set(map);
      },
      error: () => this.champions.set(new Map()),
    });
  }

  startPolling(): void {
    void this.startHub();
  }

  setSearch(term: string): void {
    this.search.set(term.trim());
    this.page.set(1);
  }

  /** Aynı alana tekrar tık → yön ters; yeni alan → Binance gibi varsayılan desc (isim hariç asc). */
  setSort(key: CryptoSortKey): void {
    if (this.sortKey() === key) {
      this.sortDesc.update((d) => !d);
    } else {
      this.sortKey.set(key);
      this.sortDesc.set(key !== 'name');
    }
    this.page.set(1);
  }

  goToPage(p: number): void {
    const max = this.totalPages();
    this.page.set(Math.min(Math.max(1, p), max));
  }

  getPrice(symbol: string): number {
    return this.priceMap()[symbol.toUpperCase()] ?? 0;
  }

  getCard(symbol: string): CryptoCardView | undefined {
    const dirs = this.tickDir();
    const t = this.tickers().find((x) => x.symbol === symbol.toUpperCase());
    return t ? toCard(t, dirs, this.champions().get(t.symbol)) : undefined;
  }

  private fetchSnapshot(showLoading: boolean): void {
    if (showLoading && this.tickers().length === 0) this.loading.set(true);
    this.error.set(null);

    this.api
      .getTickers()
      .pipe(
        catchError(() => {
          if (this.tickers().length === 0) {
            this.error.set('Kripto verileri yüklenemedi.');
          }
          this.loading.set(false);
          return of([] as CryptoTicker[]);
        }),
      )
      .subscribe({
        next: (list) => {
          if (list.length) this.mergeTickers(list);
          this.loading.set(false);
        },
      });
  }

  private async startHub(): Promise<void> {
    if (this.hub || this.hubStarting) return;
    this.hubStarting = true;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl)
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('tickers', (batch: CryptoTicker[] | unknown) => {
      // SignalR callback zone dışında kalabiliyor — UI yenilemesi için zone'a al
      this.zone.run(() => {
        const list = normalizeBatch(batch);
        if (list.length) this.mergeTickers(list);
      });
    });

    connection.onreconnecting(() => this.zone.run(() => this.live.set(false)));
    connection.onreconnected(() => {
      this.zone.run(() => {
        this.live.set(true);
        this.fetchSnapshot(false);
      });
    });
    connection.onclose(() => {
      this.zone.run(() => {
        this.live.set(false);
        this.hub = null;
      });
    });

    try {
      await connection.start();
      this.hub = connection;
      this.zone.run(() => this.live.set(true));
    } catch {
      this.zone.run(() => {
        this.live.set(false);
        this.error.set((this.error() ?? '') || 'Canlı akış bağlanamadı — REST snapshot kullanılıyor.');
      });
      setTimeout(() => {
        this.hubStarting = false;
        void this.startHub();
      }, 5000);
      return;
    } finally {
      this.hubStarting = false;
    }
  }

  private mergeTickers(incoming: CryptoTicker[]): void {
    const prev = this.tickers();
    const map = new Map(prev.map((t) => [t.symbol, t]));
    const nextDirs = { ...this.tickDir() };
    let changed = false;

    for (const raw of incoming) {
      const t = normalizeTicker(raw);
      if (!t.symbol) continue;
      if (!t.symbol.endsWith('USDT') && !FX_SYMBOLS.has(t.symbol)) continue;
      const old = map.get(t.symbol);
      if (old && old.price !== t.price) {
        nextDirs[t.symbol] = t.price > old.price ? 1 : -1;
        changed = true;
      } else if (!old) {
        changed = true;
      } else if (
        old.changePercent24h !== t.changePercent24h ||
        old.quoteVolume24h !== t.quoteVolume24h
      ) {
        changed = true;
      }

      const next = {
        ...old,
        ...t,
        priceDecimals: t.priceDecimals || old?.priceDecimals || 8,
      };
      if (
        !old ||
        old.price !== next.price ||
        old.changePercent24h !== next.changePercent24h ||
        old.quoteVolume24h !== next.quoteVolume24h ||
        old.priceDecimals !== next.priceDecimals
      ) {
        changed = true;
      }
      map.set(t.symbol, next);
    }

    if (!changed && prev.length === map.size) return;

    this.tickDir.set(nextDirs);
    this.tickers.set([...map.values()]);

    if (this.page() > this.totalPages()) this.page.set(this.totalPages());
  }
}

function sortTickers(list: CryptoTicker[], key: CryptoSortKey, desc: boolean): CryptoTicker[] {
  const mul = desc ? -1 : 1;
  const sorted = [...list];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'price':
        cmp = a.price - b.price;
        break;
      case 'change':
        cmp = a.changePercent24h - b.changePercent24h;
        break;
      case 'name':
        cmp = a.baseAsset.localeCompare(b.baseAsset);
        break;
      case 'volume':
      default:
        cmp = a.quoteVolume24h - b.quoteVolume24h;
        break;
    }
    if (cmp === 0) cmp = a.symbol.localeCompare(b.symbol);
    return cmp * mul;
  });
  return sorted;
}

function toCard(
  t: CryptoTicker,
  dirs: Record<string, 1 | -1>,
  crown?: CrownInfo,
): CryptoCardView {
  const dir = dirs[t.symbol];
  const tickUp = dir === 1 ? true : dir === -1 ? false : t.changePercent24h >= 0;
  return {
    symbol: t.symbol,
    name: t.baseAsset,
    close: t.price,
    changePct: t.changePercent24h,
    volume: t.quoteVolume24h / 1_000_000,
    color: symbolColor(t.baseAsset),
    currency: 'USD' as const,
    exchange: 'CRYPTO' as const,
    tickUp,
    priceDecimals: t.priceDecimals ?? 8,
    crownLabel: crown?.label ?? null,
    crownPeriod: crown?.period ?? null,
    crownReturnPct: crown?.returnPct ?? null,
  };
}

function normalizeBatch(batch: unknown): CryptoTicker[] {
  if (!Array.isArray(batch)) return [];
  return batch.map(normalizeTicker);
}

function normalizeTicker(raw: unknown): CryptoTicker {
  const t = raw as Record<string, unknown>;
  const symbol = String(t['symbol'] ?? t['Symbol'] ?? '').toUpperCase();
  const baseAsset = String(
    t['baseAsset'] ?? t['BaseAsset'] ?? (symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol),
  );
  return {
    symbol,
    baseAsset,
    price: num(t['price'] ?? t['Price']),
    changePercent24h: num(t['changePercent24h'] ?? t['ChangePercent24h']),
    quoteVolume24h: num(t['quoteVolume24h'] ?? t['QuoteVolume24h']),
    high24h: num(t['high24h'] ?? t['High24h']),
    low24h: num(t['low24h'] ?? t['Low24h']),
    priceDecimals: Math.floor(num(t['priceDecimals'] ?? t['PriceDecimals'] ?? 8)),
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
