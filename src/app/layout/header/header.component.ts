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
            <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
              <!-- yükselen mum/bar grafik + trend oku -->
              <rect x="4" y="18" width="4.6" height="9" rx="1.4" fill="currentColor" opacity=".55" />
              <rect x="11.7" y="13" width="4.6" height="14" rx="1.4" fill="currentColor" opacity=".78" />
              <rect x="19.4" y="8" width="4.6" height="19" rx="1.4" fill="currentColor" />
              <path
                d="M5 13.5 L12.5 8 L19 11 L28 4"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path d="M22.6 4h5.6v5.4" stroke="currentColor" stroke-width="2.4"
                    stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div>
            <h1>Sanal Portföy</h1>
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
      color: #0b1220;
      flex: none;
    }

    /* .theme-switch — şimdilik kapalı (sadece açık mod)
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

    .theme-switch button:hover { color: var(--text); }

    .theme-switch button.active {
      background: var(--panel);
      color: var(--text);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    }

    :host-context([data-theme='light']) .theme-switch button.active {
      box-shadow: 0 1px 4px rgba(21, 32, 51, 0.08);
    }
    */

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
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      /* Rozetler butonun üst kenarının dışına taştığı için üstte pay bırakılır. */
      padding-top: 6px;
      row-gap: 14px;
    }

    .fx-strip {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
      margin-top: 8px;
      max-width: 1280px;
      margin-left: auto;
      margin-right: auto;
    }

    .fx-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      color: var(--text);
      background: var(--panel2);
      border: 1px solid var(--line);
      padding: 4px 9px;
      border-radius: 999px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;

      b {
        font-weight: 800;
        font-size: 10px;
      }
    }

    /* Altın chip'inin hemen altında, sağa yaslı minimalist saat — çerçevesiz,
       kendi satırında; hiçbir öğeyi kaydırmaz. */
    .live {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 5px;
      max-width: 1280px;
      margin-left: auto;
      margin-right: auto;
      font-size: 11px;
      color: var(--muted);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--up);
      animation: pulse 1.6s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(0.8); }
    }

    .pill-btn {
      position: relative;
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      font-weight: 600;
      font-size: 12.5px;
      padding: 8px 14px;
      border-radius: 9px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      transition: border-color 0.15s, background 0.15s, transform 0.15s;
      text-decoration: none;

      &:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--text) 18%, var(--line));
        background: var(--chip-hover);
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

      &.prem {
        border-color: color-mix(in srgb, var(--prem, #b388ff) 55%, var(--line));
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--prem, #b388ff) 18%, transparent),
          color-mix(in srgb, var(--prem, #b388ff) 4%, transparent)
        );
      }

    }

    /* Rozetler butonun İÇİNDE yer kaplamaz; "CANLI VERİ" gibi üst kenarın üstüne
       oturur — böylece butonlar kısalır, satırda daha az yer kaplar. */
    .edge-tag {
      position: absolute;
      top: -8px;
      right: 8px;
      z-index: 1;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.4px;
      line-height: 1;
      padding: 3px 6px;
      border-radius: 6px;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
    }

    .new-tag {
      background: var(--up);
      color: #fff;
    }

    .prem-tag {
      background: var(--prem, #b388ff);
      color: #1a0e2e;
    }

    /* Giriş Yap üstündeki açıklama: rozetlerden bir kat daha yukarıda durur, aksi halde
       uzun olduğu için soldaki butonun PREMIUM rozetinin üstüne biniyordu. */
    .login-hint {
      top: -8px;
      right: 8px;
      font-weight: 700;
      background: var(--panel2, var(--panel));
      border: 1px solid var(--line);
      color: var(--muted);
    }

    .notif-wrap {
      position: relative;
      display: inline-flex;
    }

    .bell-btn {
      position: relative;
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      font-size: 16px;
      width: 38px;
      height: 38px;
      border-radius: 9px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s, background 0.15s, transform 0.15s;

      &:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--text) 18%, var(--line));
        background: var(--chip-hover);
      }
    }

    .bell-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      border-radius: 999px;
      background: var(--down);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      line-height: 17px;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    }

    .notif-backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
    }

    .notif-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 41;
      width: 330px;
      max-width: calc(100vw - 32px);
      max-height: 420px;
      display: flex;
      flex-direction: column;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
      overflow: hidden;
    }

    .notif-panel-head {
      padding: 12px 14px;
      font-size: 13px;
      font-weight: 800;
      border-bottom: 1px solid var(--line);
    }

    .notif-empty {
      padding: 24px 14px;
      text-align: center;
      color: var(--muted);
      font-size: 12.5px;
    }

    .notif-list {
      overflow-y: auto;
    }

    .notif-item {
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);

      &:last-child { border-bottom: none; }

      &.unread {
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
    }

    .notif-title {
      font-size: 12.5px;
      font-weight: 800;
      margin-bottom: 2px;
    }

    .notif-msg {
      font-size: 12px;
      color: var(--text);
      opacity: 0.85;
      margin-bottom: 4px;
    }

    .notif-time {
      font-size: 10.5px;
      color: var(--muted);
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

      &:hover { color: var(--down); }
    }

    /* Telefon: marka üstte tek başına, dört aksiyon butonu ALT SATIRDA yan yana.
       Etiketler (Liderler / Sanal Portföy / …) görünür kalır; sığması için sol üçü
       küçültülür, "Giriş" biraz daha büyük durur. */
    @media (max-width: 600px) {
      header {
        padding-left: 14px;
        padding-right: 14px;
      }

      .topbar { row-gap: 8px; }

      /* Telefonda butonlar bitişik dursun (masaüstündeki 8px yerine 4px). */
      .top-actions {
        flex-wrap: nowrap;
        gap: 4px;
      }

      .pill-btn {
        flex: 0 1 auto;
        min-width: 0;
        white-space: nowrap;
        font-size: 10.5px;
        padding: 7px 8px;
        gap: 4px;
      }

      .btn-label {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Giriş Yap / kullanıcı butonu: diğerlerinden bir tık büyük ve hiç kısalmasın. */
      .user-chip .pill-btn,
      .login-btn {
        flex: none;
        font-size: 12px;
        padding: 7px 11px;
      }

      /* Rozetler artık satır içinde yer kaplamadığı için telefonda da kalabilir;
         sadece uzun açıklama metni gizlenir (butondan çok daha geniş olurdu). */
      .edge-tag { font-size: 7.5px; padding: 2px 5px; right: 6px; }
      .login-hint { display: none; }

      .live { font-size: 10.5px; }
      .dot { width: 6px; height: 6px; }

      /* Dolar / Euro / Gram altın: üçü de sağda, tek satırda, yüzde + ok görünür. */
      .fx-strip {
        flex-wrap: nowrap;
        justify-content: flex-end;
        gap: 5px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        &::-webkit-scrollbar { display: none; }
      }

      .fx-chip {
        flex: none;
        font-size: 11.5px;
        padding: 5px 8px;
        gap: 5px;

        b { font-size: 10.5px; }
      }
    }

    @media (max-width: 430px) {
      .pill-btn { font-size: 9.5px; padding: 6px 7px; }
      .user-chip .pill-btn,
      .login-btn {
        font-size: 11.5px;
        padding: 7px 10px;
      }
      .fx-chip { font-size: 10.5px; padding: 4px 6px; gap: 4px; b { font-size: 9.5px; } }
    }
  `,
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
