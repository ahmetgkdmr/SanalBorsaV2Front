import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IndexService } from '../../core/services/index.service';
import { MarketTypeService } from '../../core/services/market-type.service';
import { ModalService } from '../../core/services/modal.service';
import { formatTime } from '../../core/utils/format.util';
import { MarketTickerComponent } from './market-ticker.component';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MarketTickerComponent],
  template: `
    <header>
      <div class="topbar">
        <a class="brand" routerLink="/" title="Ana ekran">
          <div class="brand-mark">{{ marketType.type() === 'crypto' ? '₿' : 'Bİ' }}</div>
          <div>
            <h1>Piyasa Ekranı</h1>
            <small>
              @if (marketType.type() === 'crypto') {
                KRİPTO · BINANCE SPOT
              } @else {
                BORSA İSTANBUL · DB FİYAT
              }
            </small>
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

      <app-market-ticker />
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
    }

    .live {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12px;
      color: var(--muted);
      background: transparent;
      border: 1px solid var(--line);
      padding: 7px 11px;
      border-radius: 9px;
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

      .prem-tag,
      .new-tag {
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.5px;
        padding: 2px 6px;
        border-radius: 6px;
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

      &:hover { color: var(--down); }
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
  readonly marketType = inject(MarketTypeService);
  private readonly indexService = inject(IndexService);

  readonly clock = signal(formatTime());

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
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.destroyRetry?.();
  }

  logout(): void {
    this.auth.logout().catch(() => null);
  }
}
