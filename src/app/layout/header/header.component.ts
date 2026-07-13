import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IndexService } from '../../core/services/index.service';
import { ModalService } from '../../core/services/modal.service';
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

      <!-- Kayan şerit — items ×2 ile seamless loop -->
      <div class="ticker-wrap">
        <div class="ticker-track">
          @for (idx of indices(); track 'a' + idx.symbol) {
            <ng-container *ngTemplateOutlet="idxChip; context: { $implicit: idx }" />
          }
          @for (idx of indices(); track 'b' + idx.symbol) {
            <ng-container *ngTemplateOutlet="idxChip; context: { $implicit: idx }" />
          }
        </div>
      </div>

      <ng-template #idxChip let-idx>
        <button
          class="idx-chip"
          type="button"
          (click)="openIndexTimeMachine(idx.symbol)"
          [title]="idx.name + ' · Zaman Makinesi'"
        >
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
        </button>
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
      background: linear-gradient(135deg, #f5b944, #e8632c);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 15px;
      color: #1a1206;
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
        border-color: #37456b;
      }

      &.prem {
        border-color: var(--prem);
        background: linear-gradient(135deg, rgba(179, 136, 255, 0.18), rgba(179, 136, 255, 0.05));
      }

      &.port {
        border-color: var(--up);
        background: linear-gradient(135deg, rgba(34, 201, 138, 0.16), rgba(34, 201, 138, 0.04));
      }

      &.gold {
        border-color: var(--accent);
        background: linear-gradient(135deg, rgba(245, 185, 68, 0.16), rgba(245, 185, 68, 0.04));
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
      background: rgba(255,255,255,0.02);
    }

    .ticker-track {
      display: flex;
      align-items: center;
      width: max-content;
      animation: ticker-scroll 70s linear infinite;

      &:hover { animation-play-state: paused; }
    }

    @keyframes ticker-scroll {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .idx-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      background: none;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      color: var(--text);
      font: inherit;
      transition: background 0.15s;

      &:hover { background: rgba(255,255,255,0.06); }
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
    }

    .ic-chg {
      font-size: 11px;
      font-weight: 600;
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
  `,
})
export class HeaderComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly modals = inject(ModalService);
  private readonly indexService = inject(IndexService);

  readonly formatNumber = formatNumber;
  readonly Math = Math;

  readonly clock = signal(formatTime());
  readonly indices = signal<
    { symbol: string; name: string; value: number; decimals: number; change: number; up: boolean }[]
  >([]);

  private clockTimer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      const quotes = this.indexService.quotes();
      if (!quotes.length) return;
      this.indices.set(
        quotes.map((q) => ({
          symbol: q.symbol,
          name: q.displayName,
          value: q.value,
          decimals: q.decimals,
          change: q.changePct,
          up: q.isUp,
        })),
      );
    });
  }

  ngOnInit(): void {
    this.indexService.loadQuotes();

    this.clockTimer = setInterval(() => {
      this.clock.set(formatTime());
    }, 1000);

    // API hazır olana kadar periyodik yeniden dene
    const retry = setInterval(() => {
      if (this.indexService.hasLiveData()) {
        clearInterval(retry);
        return;
      }
      this.indexService.loadQuotes(true);
    }, 8000);

    this.destroyRetry = () => clearInterval(retry);
  }

  private destroyRetry?: () => void;

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.destroyRetry?.();
  }

  openIndexTimeMachine(symbol: string): void {
    this.modals.openTimeMachine(symbol);
  }

  formatIdx(value: number, decimals = 2): string {
    return formatNumber(value, decimals);
  }

  logout(): void {
    this.auth.logout().catch(() => null);
  }
}
