import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEMO_INDICES } from '../../core/constants/app.constants';
import { AuthService } from '../../core/services/auth.service';
import { ModalService } from '../../core/services/modal.service';
import { formatNumber, formatTime } from '../../core/utils/format.util';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header>
      <div class="topbar">
        <a class="brand" routerLink="/" title="Ana ekran">
          <div class="brand-mark">Bİ</div>
          <div>
            <h1>Piyasa Ekranı</h1>
            <small>BORSA İSTANBUL · DB FİYAT + CANLI SİM</small>
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
                👤 <b>{{ auth.currentUser()?.username }}</b>
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

      <div class="indices">
        @for (idx of indices(); track idx.name) {
          <div class="idx">
            <div class="name">{{ idx.name }}</div>
            <div class="val mono">{{ formatIdx(idx.value, idx.decimals) }}</div>
            <div class="chg mono" [style.color]="idx.up ? 'var(--up)' : 'var(--down)'">
              {{ idx.up ? '▲' : '▼' }} %{{ formatNumber(Math.abs(idx.change)) }}
            </div>
          </div>
        }
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

    .indices {
      display: flex;
      gap: 12px;
      margin-top: 18px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .idx {
      flex: 0 0 auto;
      min-width: 190px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 14px 16px;

      .name {
        font-size: 12px;
        color: var(--muted);
        font-weight: 700;
        letter-spacing: 0.6px;
      }

      .val {
        font-size: 22px;
        font-weight: 600;
        margin-top: 4px;
      }

      .chg {
        font-size: 13px;
        font-weight: 600;
        margin-top: 2px;
      }
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

  readonly formatNumber = formatNumber;
  readonly Math = Math;

  readonly clock = signal(formatTime());
  readonly indices = signal(
    DEMO_INDICES.map((i) => ({
      ...i,
      open: i.value,
      change: 0,
      up: true,
    })),
  );

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.timer = setInterval(() => {
      this.clock.set(formatTime());
      this.indices.update((list) =>
        list.map((i) => {
          const value = i.value * (1 + (Math.random() - 0.5) * 0.0015);
          const change = ((value - i.open) / i.open) * 100;
          return { ...i, value, change, up: change >= 0 };
        }),
      );
    }, 1400);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  formatIdx(value: number, decimals = 2): string {
    return formatNumber(value, decimals);
  }

  logout(): void {
    this.auth.logout();
  }
}
