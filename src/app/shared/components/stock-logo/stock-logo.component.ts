import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';

export type LogoMarket = 'bist' | 'crypto' | 'us' | 'auto';

type LogoCatalog = {
  bist: Record<string, string[]>;
  crypto: Record<string, string[]>;
};

let catalogPromise: Promise<LogoCatalog | null> | null = null;
const catalogSignal = signal<LogoCatalog | null>(null);

function loadCatalog(): Promise<LogoCatalog | null> {
  if (!catalogPromise) {
    catalogPromise = fetch('/photos/available.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LogoCatalog | null) => {
        catalogSignal.set(data);
        return data;
      })
      .catch(() => {
        catalogSignal.set(null);
        return null;
      });
  }
  return catalogPromise;
}

void loadCatalog();

@Component({
  selector: 'app-stock-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="logo"
      [class.sm]="size() === 'sm'"
      [class.has-img]="useImage()"
      [style.background]="useImage() ? null : color()"
    >
      @if (useImage()) {
        <img
          [src]="imgSrc()!"
          [alt]="symbol()"
          loading="lazy"
          decoding="async"
          (error)="onImgError()"
        />
      } @else {
        {{ initials() }}
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      line-height: 0;
    }

    :host(.sm-host) {
      width: 28px;
      height: 28px;
    }

    .logo {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      color: #fff;
      overflow: hidden;
      background: var(--panel2);
      box-sizing: border-box;
    }

    .logo.sm {
      border-radius: 8px;
      font-size: 10px;
    }

    .logo.has-img {
      border: 1px solid var(--line);
      background: #fff;
      padding: 0;
    }

    :host-context([data-theme='dark']) .logo.has-img {
      background: var(--panel);
    }

    /* Kutuyu tamamen doldur; oranı koru, esnetme yok */
    .logo img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      object-fit: cover;
      object-position: center;
      display: block;
      pointer-events: none;
      -webkit-user-drag: none;
      image-rendering: auto;
    }
  `,
  host: {
    '[class.sm-host]': 'size() === "sm"',
  },
})
export class StockLogoComponent {
  readonly symbol = input.required<string>();
  readonly color = input.required<string>();
  readonly size = input<'md' | 'sm'>('md');
  /** bist | crypto | auto (USDT ile biterse crypto) */
  readonly market = input<LogoMarket>('auto');

  private readonly imgFailed = signal(false);

  constructor() {
    effect(() => {
      this.symbol();
      this.market();
      this.imgFailed.set(false);
    });
  }

  readonly resolvedMarket = computed<'bist' | 'crypto' | 'us'>(() => {
    const m = this.market();
    if (m === 'bist' || m === 'crypto' || m === 'us') return m;
    const sym = this.symbol().toUpperCase();
    return sym.endsWith('USDT') ? 'crypto' : 'bist';
  });

  readonly logoKey = computed(() => {
    const sym = this.symbol().toUpperCase().trim();
    if (this.resolvedMarket() === 'crypto') {
      return sym.endsWith('USDT') ? sym.slice(0, -4) : sym;
    }
    return sym;
  });

  /** Katalogdan bilinen uzantı; katalog yoksa / yüklenmediyse harf göster (404 önle) */
  readonly logoExt = computed<'svg' | 'png' | null>(() => {
    if (this.imgFailed()) return null;
    const market = this.resolvedMarket();
    // ABD hisseleri için henüz bir logo kataloğu yok — harflerle göster, 404 denemesi yapma.
    if (market === 'us') return null;
    const key = this.logoKey();
    const cat = catalogSignal();
    if (!cat) return null;

    const prefer = market === 'crypto' ? (['png', 'svg'] as const) : (['svg', 'png'] as const);
    const exts = (market === 'crypto' ? cat.crypto[key] : cat.bist[key]) ?? [];
    for (const p of prefer) {
      if (exts.includes(p)) return p;
    }
    return null;
  });

  readonly imgSrc = computed(() => {
    const ext = this.logoExt();
    if (!ext) return null;
    const folder = this.resolvedMarket() === 'crypto' ? 'crypto' : 'bist';
    return `/photos/${folder}/${this.logoKey()}.${ext}`;
  });

  readonly useImage = computed(() => !!this.imgSrc() && !this.imgFailed());

  initials(): string {
    return this.logoKey().slice(0, 2);
  }

  onImgError(): void {
    this.imgFailed.set(true);
  }
}
