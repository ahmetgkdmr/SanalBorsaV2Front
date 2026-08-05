import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CryptoApiService } from '../../core/services/crypto-api.service';
import { CryptoMarketService } from '../../core/services/crypto-market.service';
import { IndexService } from '../../core/services/index.service';
import { MarketTypeService } from '../../core/services/market-type.service';
import { ThemeService } from '../../core/services/theme.service';
import { formatCryptoPrice, formatNumber } from '../../core/utils/format.util';
import { TickerChipInput, TickerColors, TickerMessage, TickerRenderer } from './ticker-renderer';

type Slot = { id: string; name: string };

const SCROLL_SPEED = 55;
const VALUE_INTERVAL_MS = 1000;
const HEIGHT = 33;

@Component({
  selector: 'app-market-ticker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ticker-wrap" #wrap>
      <canvas class="ticker-canvas" #canvas aria-hidden="true"></canvas>
      @if (!ready()) {
        <div class="ticker-empty mono">Şerit yükleniyor…</div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }

    .ticker-wrap {
      position: relative;
      margin-top: 10px;
      width: 100%;
      height: ${HEIGHT}px;
      overflow: hidden;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--text) 3%, transparent);
      contain: strict;
    }

    :host-context([data-theme='light']) .ticker-wrap {
      background: color-mix(in srgb, var(--panel) 70%, transparent);
    }

    .ticker-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    .ticker-empty {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      padding: 0 14px;
      font-size: 12px;
      color: var(--muted);
      pointer-events: none;
    }
  `,
})
export class MarketTickerComponent implements AfterViewInit, OnDestroy {
  private readonly indexService = inject(IndexService);
  private readonly cryptoMarket = inject(CryptoMarketService);
  private readonly cryptoApi = inject(CryptoApiService);
  private readonly marketType = inject(MarketTypeService);
  private readonly theme = inject(ThemeService);

  private readonly wrapRef = viewChild<ElementRef<HTMLElement>>('wrap');
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  readonly ready = signal(false);

  private readonly cryptoStrip = signal<Slot[]>([]);
  private cryptoStripDay = '';

  private readonly bistSlots = computed<Slot[]>(
    () =>
      this.indexService
        .quotes()
        // USD/TRY artık header'ın sağ üstünde canlı gösteriliyor — şeritte tekrar etmesin.
        .filter((q) => q.symbol !== 'USDTRY')
        .map((q) => ({ id: q.symbol, name: q.displayName })),
    { equal: sameSlots },
  );

  private readonly slots = computed<Slot[]>(() =>
    this.marketType.type() === 'crypto' ? this.cryptoStrip() : this.bistSlots(),
  );

  /** Worker varsa çizim orada; yoksa aynı sınıf ana iş parçacığında çalışır. */
  private worker: Worker | null = null;
  private localRenderer: TickerRenderer | null = null;

  private valueTimer?: ReturnType<typeof setInterval>;
  private resizeObserver?: ResizeObserver;
  private viewReady = false;

  constructor() {
    // Kripto WS her modda açık kalır — BIST şeridindeki USD/TRY canlı Binance USDTTRY
    // paritesinden okunuyor (bkz. buildLookup), o yüzden bağlantı her zaman gerekli.
    untracked(() => {
      if (this.cryptoMarket.tickersCount() === 0) this.cryptoMarket.load();
    });

    effect(() => {
      if (this.marketType.type() !== 'crypto') return;
      untracked(() => this.loadCryptoStrip());
    });

    effect(() => {
      const slots = this.slots();
      this.theme.theme();
      untracked(() => {
        if (!this.viewReady) return;
        this.pushColors();
        this.pushChips(slots);
      });
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    const canvas = this.canvasRef()?.nativeElement;
    const wrap = this.wrapRef()?.nativeElement;
    if (!canvas || !wrap) return;

    const cssW = Math.max(1, wrap.clientWidth);
    const dpr = window.devicePixelRatio || 1;

    if (typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function') {
      try {
        this.worker = new Worker(new URL('./market-ticker.worker', import.meta.url), {
          type: 'module',
        });
        const offscreen = canvas.transferControlToOffscreen();
        this.post(
          {
            type: 'init',
            canvas: offscreen,
            cssW,
            cssH: HEIGHT,
            dpr,
            speed: SCROLL_SPEED,
            colors: this.readColors(),
          },
          [offscreen],
        );
      } catch {
        this.worker = null;
      }
    }

    if (!this.worker) {
      this.localRenderer = new TickerRenderer(canvas);
      this.localRenderer.setColors(this.readColors());
      this.localRenderer.setSpeed(SCROLL_SPEED);
      this.localRenderer.resize(cssW, HEIGHT, dpr);
      this.localRenderer.start();
    }

    this.pushChips(untracked(() => this.slots()));

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        const w = Math.max(1, wrap.clientWidth);
        this.send({ type: 'resize', cssW: w, cssH: HEIGHT, dpr: window.devicePixelRatio || 1 });
      });
      this.resizeObserver.observe(wrap);
    }

    this.valueTimer = setInterval(() => this.pushValues(), VALUE_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.valueTimer) clearInterval(this.valueTimer);
    this.resizeObserver?.disconnect();
    this.send({ type: 'stop' });
    this.worker?.terminate();
    this.localRenderer?.stop();
  }

  private send(msg: TickerMessage): void {
    if (this.worker) this.worker.postMessage(msg);
    else this.applyLocal(msg);
  }

  private post(msg: TickerMessage, transfer: Transferable[]): void {
    this.worker?.postMessage(msg, transfer);
  }

  private applyLocal(msg: TickerMessage): void {
    const r = this.localRenderer;
    if (!r) return;
    switch (msg.type) {
      case 'resize': r.resize(msg.cssW, msg.cssH, msg.dpr); break;
      case 'colors': r.setColors(msg.colors); break;
      case 'chips': r.setChips(msg.chips); break;
      case 'values': r.setValues(msg.values); break;
      case 'stop': r.stop(); break;
    }
  }

  private pushColors(): void {
    this.send({ type: 'colors', colors: this.readColors() });
  }

  private pushChips(slots: Slot[]): void {
    if (!slots.length) {
      this.ready.set(false);
      return;
    }
    const lookup = this.buildLookup();
    const chips: TickerChipInput[] = slots.map((s) => {
      const v = lookup.get(s.id);
      return {
        id: s.id,
        name: s.name,
        value: v?.value ?? '—',
        change: v?.change ?? '',
        up: v?.up ?? true,
      };
    });
    this.send({ type: 'chips', chips });
    this.ready.set(true);
  }

  /** Sadece rakamları gönderir — postMessage maliyeti ihmal edilebilir. */
  private pushValues(): void {
    const slots = untracked(() => this.slots());
    if (!slots.length) return;
    const lookup = this.buildLookup();
    const values: TickerChipInput[] = [];
    for (const s of slots) {
      const v = lookup.get(s.id);
      if (!v) continue;
      values.push({ id: s.id, name: s.name, value: v.value, change: v.change, up: v.up });
    }
    if (values.length) this.send({ type: 'values', values });
  }

  private buildLookup(): Map<string, { value: string; change: string; up: boolean }> {
    const map = new Map<string, { value: string; change: string; up: boolean }>();

    if (untracked(() => this.marketType.type()) === 'crypto') {
      for (const [symbol, t] of untracked(() => this.cryptoMarket.tickerMap())) {
        const up = t.changePercent24h >= 0;
        map.set(symbol, {
          value: `${formatCryptoPrice(t.price, t.priceDecimals)} $`,
          change: `${up ? '▲' : '▼'} %${formatNumber(Math.abs(t.changePercent24h))}`,
          up,
        });
      }
    } else {
      for (const q of untracked(() => this.indexService.quotes())) {
        if (q.value <= 0) continue;
        map.set(q.symbol, {
          value: formatNumber(q.value, q.decimals),
          change: `${q.isUp ? '▲' : '▼'} %${formatNumber(Math.abs(q.changePct))}`,
          up: q.isUp,
        });
      }
    }
    return map;
  }

  private readColors(): TickerColors {
    const root = getComputedStyle(document.documentElement);
    const text = root.getPropertyValue('--text').trim() || '#e8edf6';
    return {
      text,
      muted: root.getPropertyValue('--muted').trim() || '#8593ad',
      up: root.getPropertyValue('--up').trim() || '#22c98a',
      down: root.getPropertyValue('--down').trim() || '#f0506e',
      sep: withAlpha(text, 0.16),
    };
  }

  private loadCryptoStrip(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.cryptoStripDay === today && this.cryptoStrip().length) return;

    this.cryptoApi.getTickerStrip(20).subscribe({
      next: (items) => {
        if (!items.length) return;
        this.cryptoStripDay = today;
        this.cryptoStrip.set(items.map((i) => ({ id: i.symbol, name: `${i.baseAsset}/USDT` })));
      },
      error: () => undefined,
    });
  }
}

function sameSlots(a: Slot[], b: Slot[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.id === b[i].id && s.name === b[i].name);
}

function withAlpha(cssColor: string, alpha: number): string {
  const c = cssColor.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    const full =
      hex.length === 3
        ? hex.split('').map((ch) => ch + ch).join('')
        : hex.slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if ([r, g, b].every((n) => Number.isFinite(n))) return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(128,128,128,${alpha})`;
}
