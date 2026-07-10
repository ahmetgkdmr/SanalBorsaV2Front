import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { buildLeaderboard, LeaderboardEntry } from '../../core/constants/leaderboard.mock';
import { PREMIUM_PASSWORD } from '../../core/constants/app.constants';
import { ModalService } from '../../core/services/modal.service';
import { formatInteger, formatNumber } from '../../core/utils/format.util';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';

@Component({
  selector: 'app-leaderboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, OverlayComponent],
  template: `
    <section class="page">
      <a class="btn back-btn" routerLink="/">← Piyasa Ekranı</a>

      <h2 style="margin-top: 22px">
        🏆 Haftanın En Çok Kazananları <span class="new-tag">YENİ</span>
      </h2>
      <p class="sub">
        Bu hafta sanal portföyünü en çok büyüten yatırımcılar. {{ weekLabel }}
      </p>

      <div class="prem-banner">
        Yatırımcı işlem detayları premium üyelere özel. Demo şifre: <b>12345</b>
      </div>

      <div class="podium">
        @for (p of podium(); track p.username) {
          <div class="pod" [class.first]="$index === 0">
            <div class="medal">{{ medals[$index] }}</div>
            <div class="av" [style.background]="p.avatarColor">{{ p.username.slice(0, 2).toUpperCase() }}</div>
            <div class="nm">{{ p.username }}</div>
            <div class="gain">+%{{ formatNumber(p.gainPct) }}</div>
            <div class="pv mono">{{ formatInteger(p.portfolioValue) }} ₺</div>
          </div>
        }
      </div>

      <div class="sec-h">SIRALAMA</div>
      @for (e of pageEntries(); track e.username) {
        <div class="ldr-row">
          <span class="ldr-rank">#{{ e.rank }}</span>
          <div class="ldr-av" [style.background]="e.avatarColor">{{ e.username.slice(0, 2).toUpperCase() }}</div>
          <div class="ldr-nm">{{ e.username }}</div>
          <span class="ldr-gain">+%{{ formatNumber(e.gainPct) }}</span>
          <span class="ldr-pv mono">{{ formatInteger(e.portfolioValue) }} ₺</span>
          <button
            class="btn ldr-detail"
            [class.unlocked]="modals.premiumUnlocked()"
            type="button"
            (click)="openDetail(e)"
          >
            {{ modals.premiumUnlocked() ? 'İşlemler' : '🔐 Detay' }}
          </button>
        </div>
      }

      <div class="pager">
        <button type="button" [disabled]="page() === 1" (click)="page.set(page() - 1)">←</button>
        <button type="button" class="cur">{{ page() }}</button>
        <button type="button" [disabled]="page() >= totalPages" (click)="page.set(page() + 1)">→</button>
      </div>
    </section>

    <app-overlay [open]="!!detail()" (closed)="detail.set(null)">
      @if (detail(); as d) {
        <div class="modal">
          <button class="m-close" type="button" (click)="detail.set(null)">✕</button>
          <h2>{{ d.username }} — işlemler</h2>
          @for (t of d.trades; track t.at) {
            <div class="tx">{{ t.side }} {{ t.lots }} lot {{ t.symbol }} · {{ t.at }}</div>
          }
        </div>
      }
    </app-overlay>

    <app-overlay [open]="showPremium()" (closed)="showPremium.set(false)">
      <div class="modal" style="max-width: 420px">
        <button class="m-close" type="button" (click)="showPremium.set(false)">✕</button>
        <h2>🔐 Premium Özellik</h2>
        <p class="sub">Demo için premium şifresini gir.</p>
        <input class="f-input mono" type="password" #pass placeholder="Premium şifre" />
        <button class="btn btn-prem" type="button" style="margin-top: 12px; width: 100%; justify-content: center" (click)="unlock(pass.value)">
          ✨ Kilidi Aç
        </button>
        @if (premMsg()) {
          <div class="trade-msg" style="margin-top: 8px">{{ premMsg() }}</div>
        }
      </div>
    </app-overlay>
  `,
  styles: `
    h2 {
      font-size: 21px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .prem-banner {
      margin-top: 16px;
      background: linear-gradient(135deg, rgba(124, 77, 255, 0.15), rgba(179, 136, 255, 0.05));
      border: 1px solid var(--prem);
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 12.5px;
      line-height: 1.6;
    }

    .podium {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 24px;
    }

    .pod {
      background: linear-gradient(160deg, var(--panel), #182036);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 20px 16px;
      text-align: center;

      &.first {
        border-color: var(--accent);
        box-shadow: 0 6px 30px rgba(245, 185, 68, 0.12);
      }

      .medal {
        font-size: 30px;
      }

      .av {
        width: 56px;
        height: 56px;
        border-radius: 16px;
        margin: 10px auto 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 20px;
        color: #fff;
      }

      .nm {
        font-weight: 800;
        font-size: 14px;
      }

      .gain {
        font-size: 20px;
        font-weight: 800;
        color: var(--up);
        margin-top: 6px;
      }

      .pv {
        font-size: 11px;
        color: var(--muted);
        margin-top: 2px;
      }
    }

    .ldr-row {
      display: flex;
      align-items: center;
      gap: 13px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 13px;
      padding: 12px 15px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .ldr-rank {
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 700;
      color: var(--muted);
      width: 30px;
    }

    .ldr-av {
      width: 40px;
      height: 40px;
      border-radius: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      color: #fff;
      flex: 0 0 auto;
    }

    .ldr-nm {
      font-weight: 700;
      min-width: 130px;
    }

    .ldr-gain {
      font-weight: 800;
      color: var(--up);
    }

    .ldr-pv {
      color: var(--muted);
      font-size: 12px;
    }

    .ldr-detail {
      margin-left: auto;
      background: var(--panel2);
      border: 1px solid var(--prem);
      color: var(--prem);
      font-size: 11.5px;
      padding: 8px 13px;

      &.unlocked {
        color: #fff;
        background: linear-gradient(135deg, #7c4dff, #b388ff);
        border: none;
      }
    }

    .pager {
      display: flex;
      gap: 8px;
      justify-content: center;
      align-items: center;
      margin: 18px 0 40px;

      button {
        background: var(--panel2);
        border: 1px solid var(--line);
        color: var(--text);
        font-weight: 700;
        padding: 9px 15px;
        border-radius: 10px;
        cursor: pointer;

        &.cur {
          background: var(--accent);
          color: #1a1206;
          border-color: var(--accent);
        }

        &:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
      }
    }

    .modal {
      max-width: 560px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 26px;
      position: relative;
    }

    .m-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--panel2);
      border: 1px solid var(--line);
      color: var(--muted);
      width: 34px;
      height: 34px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 16px;
    }

    .tx {
      margin-top: 8px;
      font-size: 13px;
      color: var(--muted);
    }

    @media (max-width: 600px) {
      .podium {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .ldr-nm {
        min-width: 90px;
      }
    }
  `,
})
export class LeaderboardPageComponent {
  readonly modals = inject(ModalService);
  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;
  readonly medals = ['🥇', '🥈', '🥉'];

  readonly entries = buildLeaderboard();
  readonly page = signal(1);
  readonly pageSize = 7;
  readonly detail = signal<LeaderboardEntry | null>(null);
  readonly showPremium = signal(false);
  readonly premMsg = signal('');
  readonly pending = signal<LeaderboardEntry | null>(null);

  readonly weekLabel = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  readonly totalPages = Math.ceil(this.entries.length / this.pageSize);

  readonly podium = computed(() => this.entries.slice(0, 3));

  readonly pageEntries = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.entries.slice(start, start + this.pageSize);
  });

  openDetail(entry: LeaderboardEntry): void {
    if (!this.modals.premiumUnlocked()) {
      this.pending.set(entry);
      this.showPremium.set(true);
      return;
    }
    this.detail.set(entry);
  }

  unlock(password: string): void {
    if (password === PREMIUM_PASSWORD) {
      this.modals.unlockPremium();
      this.showPremium.set(false);
      this.premMsg.set('');
      if (this.pending()) {
        this.detail.set(this.pending());
        this.pending.set(null);
      }
    } else {
      this.premMsg.set('Yanlış şifre.');
    }
  }
}
