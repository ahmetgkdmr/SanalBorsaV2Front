import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IndexService } from '../../core/services/index.service';
import { ModalService } from '../../core/services/modal.service';
import { ThemeService, AppTheme } from '../../core/services/theme.service';
import { formatNumber, formatTime } from '../../core/utils/format.util';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <header>
      <div class="topbar">
        <a class="brand" routerLink="/" title="Ana ekran">
          <div class="brand-mark">Bİ</div>
          <div>
            <h1>Piyasa Ekranı</h1>
            <small>BORSA İSTANBUL · DB FİYAT</small>
          </div>
        </a>

        <div class="top-actions">
          <div class="theme-switch" role="group" aria-label="Görünüm teması">
            <button
              type="button"
              [class.active]="theme.theme() === 'dark'"
              (click)="setTheme('dark')"
              title="Koyu mod"
            >
              Koyu
            </button>
            <button
              type="button"
              [class.active]="theme.theme() === 'light'"
              (click)="setTheme('light')"
              title="Açık mod"
            >
              Açık
            </button>
          </div>

          <button class="pill-btn prem" type="button" (click)="modals.openTimeMachine()">
            🕰️ Zaman Makinesi <span class="prem-tag">PREMIUM</span>
          </button>
          <a class="pill-btn gold" routerLink="/leaderboard">🏆 Liderler <span class="new-tag">YENİ</span></a>
          <a class="pill-btn port" routerLink="/portfolio">💼 Sanal Portföy</a>

          @if (auth.isLoggedIn()) {
            <span class="user-chip">
              <button class="pill-btn" type="button" routerLink="/portfolio">
                👤 <b>{{ auth.currentUser()?.displayName }}</b>
              </button>
              <button class="logout" type="button" (click)="logout()" title="Çıkış">⏻</button>
            </span>
          } @else {
            <button class="pill-btn" type="button" (click)="modals.open('login')">👤 Giriş</button>
          }

          <div class="live">
            <span class="dot"></span>
            <span class="mono">{{ clock() }}</span>
          </div>
        </div>
      </div>

      <!-- Kayan şerit — items ×2 ile seamless loop (hover’da durmaz, tıklanmaz) -->
      <div class="ticker-wrap">
        <div class="ticker-track" #tickerTrack>
          @for (idx of indices(); track 'a-' + idx.symbol) {
            <ng-container *ngTemplateOutlet="idxChip; context: { $implicit: idx }" />
          }
          @for (idx of indices(); track 'b-' + idx.symbol) {
            <ng-container *ngTemplateOutlet="idxChip; context: { $implicit: idx }" />
          }
        </div>
      </div>

      <ng-template #idxChip let-idx>
        <span class="idx-chip" [title]="idx.name">
          <span class="ic-name">{{ idx.name }}</span>
          <span class="ic-val mono">
            @if (idx.value > 0) { {{ formatIdx(idx.value, idx.decimals) }} }
            @else { <span class="ic-dot">…</span> }
          </span>
          @if (idx.value > 0) {
            <span class="ic-chg mono" [style.color]="idx.up ? 'var(--up)' : 'var(--down)'">
              {{ idx.up ? '▲' : '▼' }}&nbsp;%{{ formatNumber(Math.abs(idx.change)) }}
            </span>
          }
        </span>
        <span class="ic-sep">|</span>
      </ng-template>
    </header>
  `,
  styles: `
    header {
      padding: 20px 24px 0;
      max-width: 1280px;
      margin: 0 auto;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }

    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #e8632c));
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 15px;
      color: #0b1220;
    }

    .theme-switch {
      display: inline-flex;
      align-items: center;
      padding: 3px;
      gap: 2px;
      border-radius: 100px;
      border: 1px solid var(--line);
      background: var(--panel2);
    }

    .theme-switch button {
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 11.5px;
      font-weight: 700;
      padding: 7px 11px;
      border-radius: 100px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, color 0.15s;
    }

    .theme-switch button:hover {
      color: var(--text);
    }

    .theme-switch button.active {
      background: var(--panel);
      color: var(--text);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    }

    :host-context([data-theme='light']) .theme-switch button.active {
      box-shadow: 0 1px 4px rgba(21, 32, 51, 0.08);
    }

    .brand h1 {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.3px;
    }

    .brand small {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--muted);
      letter-spacing: 0.4px;
    }

    .top-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .live {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--muted);
      background: var(--panel);
      border: 1px solid var(--line);
      padding: 8px 14px;
      border-radius: 100px;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--up);
      animation: pulse 1.6s infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.35;
        transform: scale(0.8);
      }
    }

    .pill-btn {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      font-weight: 700;
      font-size: 13px;
      padding: 9px 16px;
      border-radius: 100px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: 0.15s;
      text-decoration: none;

      &:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--text) 22%, var(--line));
        background: var(--chip-hover);
      }

      &.prem {
        border-color: color-mix(in srgb, var(--prem) 55%, var(--line));
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--prem) 22%, transparent),
          color-mix(in srgb, var(--prem) 6%, transparent)
        );
      }

      &.port {
        border-color: color-mix(in srgb, var(--up) 55%, var(--line));
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--up) 18%, transparent),
          color-mix(in srgb, var(--up) 4%, transparent)
        );
      }

      &.gold {
        border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--accent) 18%, transparent),
          color-mix(in srgb, var(--accent) 4%, transparent)
        );
      }
    }

    .user-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .logout {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 14px;
      padding: 4px;

      &:hover {
        color: var(--down);
      }
    }

    /* ── kayan şerit ─────────────────────────────────────────────────────── */
    .ticker-wrap {
      margin-top: 10px;
      width: 100%;
      overflow: hidden;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--text) 3%, transparent);
      border-radius: 0;
    }

    :host-context([data-theme='light']) .ticker-wrap {
      background: color-mix(in srgb, var(--panel) 70%, transparent);
    }

    .ticker-track {
      display: flex;
      align-items: center;
      width: max-content;
      will-change: transform;
      transform: translate3d(0, 0, 0);
      backface-visibility: hidden;
    }

    .idx-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      white-space: nowrap;
      color: var(--text);
      font: inherit;
      user-select: none;
      pointer-events: none;
    }

    .ic-name {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--muted);
      text-transform: uppercase;
    }

    .ic-val {
      font-size: 13px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      min-width: 6.5ch;
      text-align: right;
    }

    .ic-chg {
      font-size: 11px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      min-width: 5.5ch;
    }

    .ic-dot { color: var(--muted); }

    .ic-sep {
      color: rgba(255,255,255,0.12);
      font-size: 14px;
      padding: 0 2px;
      user-select: none;
    }

    @media (max-width: 600px) {
      header {
        padding-left: 14px;
        padding-right: 14px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .ticker-track {
        transform: none !important;
      }
    }
  `,
})
export class HeaderComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tickerTrack', { static: true }) tickerTrack!: ElementRef<HTMLElement>;

  readonly auth = inject(AuthService);
  readonly modals = inject(ModalService);
  readonly theme = inject(ThemeService);
  private readonly indexService = inject(IndexService);
  private readonly zone = inject(NgZone);

  readonly formatNumber = formatNumber;
  readonly Math = Math;

  readonly clock = signal(formatTime());
  readonly indices = signal<
    { symbol: string; name: string; value: number; decimals: number; change: number; up: boolean }[]
  >([]);

  private clockTimer?: ReturnType<typeof setInterval>;
  private destroyRetry?: () => void;
  private rafId = 0;
  private lastTs = 0;
  private offsetPx = 0;
  private loopWidth = 0;
  private readonly speedPxPerSec = 42;
  private reduceMotion = false;

  constructor() {
    effect(() => {
      const quotes = this.indexService.quotes();
      if (!quotes.length) return;

      const next = quotes.map((q) => ({
        symbol: q.symbol,
        name: q.displayName,
        value: q.value,
        decimals: q.decimals,
        change: q.changePct,
        up: q.isUp,
      }));

      const prev = this.indices();
      const sameShape =
        prev.length === next.length && prev.every((p, i) => p.symbol === next[i].symbol);

      // Aynı sembol setiyse yalnızca değerleri güncelle — DOM yapısı sabit kalsın
      if (sameShape) {
        let changed = false;
        for (let i = 0; i < next.length; i++) {
          const a = prev[i];
          const b = next[i];
          if (a.value !== b.value || a.change !== b.change || a.up !== b.up || a.name !== b.name) {
            changed = true;
            break;
          }
        }
        if (!changed) return;
      }

      this.indices.set(next);
      // Genişlik değişebilir; bir sonraki frame’de ölç
      queueMicrotask(() => this.measureLoop());
    });
  }

  ngOnInit(): void {
    this.reduceMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.indexService.loadQuotes();

    this.clockTimer = setInterval(() => {
      this.clock.set(formatTime());
    }, 1000);

    const retry = setInterval(() => {
      if (this.indexService.hasLiveData()) {
        clearInterval(retry);
        return;
      }
      this.indexService.loadQuotes(true);
    }, 8000);

    this.destroyRetry = () => clearInterval(retry);
  }

  ngAfterViewInit(): void {
    this.measureLoop();
    if (!this.reduceMotion) {
      this.zone.runOutsideAngular(() => this.startTicker());
    }
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.destroyRetry?.();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  formatIdx(value: number, decimals = 2): string {
    return formatNumber(value, decimals);
  }

  setTheme(theme: AppTheme): void {
    this.theme.setTheme(theme);
  }

  logout(): void {
    this.auth.logout().catch(() => null);
  }

  private measureLoop(): void {
    const el = this.tickerTrack?.nativeElement;
    if (!el) return;
    // İki kopya yan yana → loop genişliği yarısı
    this.loopWidth = el.scrollWidth / 2;
    if (this.loopWidth > 0 && this.offsetPx >= this.loopWidth) {
      this.offsetPx = this.offsetPx % this.loopWidth;
      el.style.transform = `translate3d(${-this.offsetPx}px, 0, 0)`;
    }
  }

  private startTicker(): void {
    const step = (ts: number) => {
      const el = this.tickerTrack?.nativeElement;
      if (el) {
        if (!this.loopWidth) this.measureLoop();

        if (this.loopWidth > 0) {
          if (!this.lastTs) this.lastTs = ts;
          const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
          this.lastTs = ts;
          this.offsetPx += this.speedPxPerSec * dt;
          if (this.offsetPx >= this.loopWidth) {
            this.offsetPx -= this.loopWidth;
          }
          el.style.transform = `translate3d(${-this.offsetPx}px, 0, 0)`;
        }
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }
}
