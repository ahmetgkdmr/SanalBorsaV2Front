import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CryptoMarketService } from '../../core/services/crypto-market.service';
import { IndexService } from '../../core/services/index.service';
import { MarketTypeService } from '../../core/services/market-type.service';
import { ModalService } from '../../core/services/modal.service';
import { NotificationService } from '../../core/services/notification.service';
import { formatNumber, formatRelativeTime, formatTime } from '../../core/utils/format.util';
import { MarketTickerComponent } from './market-ticker.component';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MarketTickerComponent],
  template: `
    <header>
      <div class="topbar">
        <a class="brand" routerLink="/" title="Ana ekran">
          <div class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
              <!-- 3 mum grafiği (candlestick), sabit taban yükselen boy + tepe noktasında fiyat işaretçisi -->
              <line x1="7.5" y1="17" x2="7.5" y2="29" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".5" />
              <rect x="5" y="20" width="5" height="7" rx="1.4" fill="currentColor" opacity=".5" />
              <line x1="16" y1="11" x2="16" y2="29" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".72" />
              <rect x="13.5" y="14" width="5" height="13" rx="1.4" fill="currentColor" opacity=".72" />
              <line x1="24.5" y1="4" x2="24.5" y2="29" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              <rect x="22" y="7" width="5" height="20" rx="1.4" fill="currentColor" />
              <path
                d="M4 24 Q11 22 16 15 T25 4"
                stroke="currentColor"
                stroke-width="1.1"
                stroke-linecap="round"
                stroke-dasharray="0.5 3.2"
                opacity=".5"
              />
              <circle cx="25" cy="4" r="2.1" fill="currentColor" />
              <circle cx="25" cy="4" r="2.1" fill="none" stroke="#fff" stroke-width=".6" opacity=".6" />
            </svg>
          </div>
          <div class="brand-text">
            <h1><span class="brand-grad">Sanal</span> Portföy</h1>
          </div>
        </a>

        <div class="top-actions">
          <a class="pill-btn gold" routerLink="/leaderboard" title="Liderler">
            🏆 <span class="btn-label">Liderler</span>
            <span class="edge-tag new-tag">YENİ</span>
          </a>
          <a class="pill-btn port" routerLink="/portfolio" title="Sanal Portföy">
            💼 <span class="btn-label">Sanal Portföy</span>
            <span class="edge-tag prem-tag">PREMIUM</span>
          </a>
          <button class="pill-btn prem" type="button" title="Zaman Makinesi" (click)="modals.openTimeMachine()">
            🕰️ <span class="btn-label">Zaman Makinesi</span>
            <span class="edge-tag prem-tag">PREMIUM</span>
          </button>

          @if (auth.isLoggedIn()) {
            <span class="notif-wrap">
              <button
                class="bell-btn"
                type="button"
                title="Bildirimler"
                (click)="toggleNotifications()"
              >
                🔔
                @if (notifications.unreadCount() > 0) {
                  <span class="bell-badge">{{ notifications.unreadCount() > 9 ? '9+' : notifications.unreadCount() }}</span>
                }
              </button>

              @if (notifOpen()) {
                <div class="notif-backdrop" (click)="notifOpen.set(false)"></div>
                <div class="notif-panel">
                  <div class="notif-panel-head">Bildirimler</div>
                  @if (notifications.items().length === 0) {
                    <div class="notif-empty">Henüz bildirim yok.</div>
                  } @else {
                    <div class="notif-list">
                      @for (n of notifications.items(); track n.id) {
                        <div class="notif-item" [class.unread]="!n.isRead">
                          <div class="notif-title">{{ n.title }}</div>
                          <div class="notif-msg">{{ n.message }}</div>
                          <div class="notif-time">{{ formatRelativeTime(n.createdAt) }}</div>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </span>

            <span class="user-chip">
              <button class="pill-btn" type="button" routerLink="/portfolio">
                👤 <b class="btn-label">{{ auth.currentUser()?.username || auth.currentUser()?.displayName }}</b>
              </button>
              <button class="logout" type="button" (click)="logout()" title="Çıkış">⏻</button>
            </span>
          } @else {
            <button class="pill-btn login-btn" type="button" title="Giriş Yap" (click)="modals.open('login')">
              👤 <span class="btn-label">Giriş Yap</span>
              <span class="edge-tag login-hint">Sanal alım için</span>
            </button>
          }
        </div>
      </div>

      <app-market-ticker />

      <div class="fx-strip">
        @if (usdTry(); as q) {
          <span class="fx-chip" title="USD/TRY (Binance USDT/TRY)">
            💵 {{ formatNumber(q.value, 5) }}
            <b [style.color]="q.changePct >= 0 ? 'var(--up)' : 'var(--down)'">
              {{ q.changePct >= 0 ? '▲' : '▼' }} %{{ formatNumber(abs(q.changePct), 2) }}
            </b>
          </span>
        }
        @if (eurTry(); as q) {
          <span class="fx-chip" title="EUR/TRY (Binance EUR/USDT × USDT/TRY)">
            💶 {{ formatNumber(q.value, 5) }}
            <b [style.color]="q.changePct >= 0 ? 'var(--up)' : 'var(--down)'">
              {{ q.changePct >= 0 ? '▲' : '▼' }} %{{ formatNumber(abs(q.changePct), 2) }}
            </b>
          </span>
        }
        @if (gramAltin(); as q) {
          <span class="fx-chip" title="Gram Altın/TRY">
            🥇 {{ formatNumber(q.value, 2) }}
            <b [style.color]="q.changePct >= 0 ? 'var(--up)' : 'var(--down)'">
              {{ q.changePct >= 0 ? '▲' : '▼' }} %{{ formatNumber(abs(q.changePct), 2) }}
            </b>
          </span>
        }
      </div>

      <!-- Saat: altın chip'inin hemen altında, sağa yaslı. Kendi satırında durduğu
           için üstteki hiçbir öğenin yerleşimini kaydırmıyor. -->
      <div class="live">
        <span class="dot"></span>
        <span class="mono">{{ clock() }}</span>
      </div>
    </header>
  `,
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly modals = inject(ModalService);
  readonly marketType = inject(MarketTypeService);
  readonly notifications = inject(NotificationService);
  private readonly indexService = inject(IndexService);
  private readonly cryptoMarket = inject(CryptoMarketService);

  readonly formatNumber = formatNumber;
  readonly formatRelativeTime = formatRelativeTime;
  readonly abs = Math.abs;
  readonly clock = signal(formatTime());
  readonly notifOpen = signal(false);

  readonly usdTry = this.cryptoMarket.usdTry;
  readonly eurTry = this.cryptoMarket.eurTry;
  readonly gramAltin = this.cryptoMarket.gramAltin;

  private clockTimer?: ReturnType<typeof setInterval>;
  private destroyRetry?: () => void;

  ngOnInit(): void {
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

    this.notifications.startPolling();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.destroyRetry?.();
    this.notifications.stopPolling();
  }

  toggleNotifications(): void {
    const next = !this.notifOpen();
    this.notifOpen.set(next);
    if (next) void this.notifications.markAllRead();
  }

  logout(): void {
    this.auth.logout().catch(() => null);
    void this.notifications.reload();
  }
}
