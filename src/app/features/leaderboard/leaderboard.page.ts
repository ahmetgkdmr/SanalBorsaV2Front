import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  buildLeaderboard,
  LeaderboardEntry,
  LeaderTrade,
} from '../../core/constants/leaderboard.mock';
import { formatInteger, formatNumber, symbolColor } from '../../core/utils/format.util';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';
import { StockLogoComponent } from '../../shared/components/stock-logo/stock-logo.component';

const DETAIL_PAGE_SIZE = 5;

@Component({
  selector: 'app-leaderboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, OverlayComponent, StockLogoComponent, DatePipe],
  template: `
    <section class="page">
      <a class="btn back-btn" routerLink="/">← Piyasa Ekranı</a>

      <h2 style="margin-top: 22px">
        🏆 Haftanın En Çok Kazananları <span class="new-tag">YENİ</span>
      </h2>
      <p class="sub">
        Bu hafta sanal portföyünü en çok büyüten yatırımcılar. {{ weekLabel }}
      </p>

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
            [class.locked]="!e.tradeHistoryPublic"
            type="button"
            (click)="openDetail(e)"
          >
            {{ e.tradeHistoryPublic ? 'Detay' : '🔐 Detay' }}
          </button>
        </div>
      }

      <div class="pager">
        <button type="button" [disabled]="page() === 1" (click)="page.set(page() - 1)">←</button>
        <button type="button" class="cur">{{ page() }}</button>
        <button type="button" [disabled]="page() >= totalPages" (click)="page.set(page() + 1)">→</button>
      </div>
    </section>

    <app-overlay [open]="!!detail()" (closed)="closeDetail()">
      @if (detail(); as d) {
        <div class="modal">
          <button class="m-close" type="button" (click)="closeDetail()">✕</button>
          <div class="modal-head">
            <div class="av big" [style.background]="d.avatarColor">{{ d.username.slice(0, 2).toUpperCase() }}</div>
            <div>
              <h2>{{ d.username }}</h2>
              <p class="sub">İşlem geçmişi · #{{ d.rank }}</p>
            </div>
          </div>

          <div class="tx-wrap" [class.private]="!d.tradeHistoryPublic">
            <div class="tx-list" [class.blurred]="!d.tradeHistoryPublic">
              @for (t of detailPageTrades(); track t.at + t.symbol + t.side + t.lots) {
                <div class="tx-card" [class.buy]="t.side === 'AL'" [class.sell]="t.side === 'SAT'">
                  <span class="side-pill" [class.al]="t.side === 'AL'" [class.sat]="t.side === 'SAT'">
                    {{ t.side === 'AL' ? '🟢 AL' : '🔴 SAT' }}
                  </span>
                  <app-stock-logo
                    [symbol]="t.symbol"
                    [color]="symbolColor(t.symbol)"
                    market="bist"
                    size="sm"
                  />
                  <div class="tx-main">
                    <b>{{ t.symbol }}</b>
                    <span class="tx-sub mono">{{ t.lots }} lot</span>
                  </div>
                  @if (t.price != null) {
                    <span class="tx-price mono">{{ formatNumber(t.price) }} ₺</span>
                  }
                  <span class="tx-when">{{ t.at | date: 'dd.MM.yyyy' }}</span>
                </div>
              }
            </div>

            @if (!d.tradeHistoryPublic) {
              <div class="lock-overlay">
                <div class="lock-icon">🔒</div>
                <div class="lock-title">İşlem geçmişi gizli</div>
                <p class="lock-text">Bu yatırımcı işlem detaylarını paylaşmayı tercih etmedi.</p>
              </div>
            }
          </div>

          @if (d.tradeHistoryPublic && detailTotalPages() > 1) {
            <div class="detail-pager">
              <button
                class="btn pager-btn"
                type="button"
                [disabled]="detailPage() <= 1"
                (click)="detailPage.set(detailPage() - 1)"
              >
                ← Önceki
              </button>
              <span class="pager-meta mono">
                Sayfa {{ detailPage() }} / {{ detailTotalPages() }}
                · {{ d.trades.length }} işlem
              </span>
              <button
                class="btn pager-btn"
                type="button"
                [disabled]="detailPage() >= detailTotalPages()"
                (click)="detailPage.set(detailPage() + 1)"
              >
                Sonraki →
              </button>
            </div>
          }
        </div>
      }
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
      margin: 0;
    }

    .podium {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 24px;
    }

    .pod {
      background: linear-gradient(160deg, var(--panel), var(--panel-grad-end));
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 20px 16px;
      text-align: center;

      &.first {
        border-color: var(--accent);
        box-shadow: 0 6px 30px rgba(245, 185, 68, 0.12);
      }

      .medal { font-size: 30px; }
      .av {
        width: 56px; height: 56px; border-radius: 16px;
        margin: 10px auto 8px; display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 20px; color: #fff;
      }
      .nm { font-weight: 800; font-size: 14px; }
      .gain { font-size: 20px; font-weight: 800; color: var(--up); margin-top: 6px; }
      .pv { font-size: 11px; color: var(--muted); margin-top: 2px; }
    }

    .ldr-row {
      display: flex; align-items: center; gap: 13px;
      background: var(--panel); border: 1px solid var(--line);
      border-radius: 13px; padding: 12px 15px; margin-bottom: 8px; flex-wrap: wrap;
    }
    .ldr-rank {
      font-family: 'IBM Plex Mono', monospace; font-weight: 700;
      color: var(--muted); width: 30px;
    }
    .ldr-av, .av.big {
      width: 40px; height: 40px; border-radius: 11px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; color: #fff; flex: 0 0 auto;
    }
    .av.big { width: 52px; height: 52px; border-radius: 14px; font-size: 18px; }
    .ldr-nm { font-weight: 700; min-width: 130px; }
    .ldr-gain { font-weight: 800; color: var(--up); }
    .ldr-pv { color: var(--muted); font-size: 12px; }
    .ldr-detail {
      margin-left: auto;
      background: linear-gradient(135deg, #16a34a, #0e7a55);
      border: none; color: #fff; font-size: 11.5px; padding: 8px 13px; font-weight: 700;
      &.locked {
        background: var(--panel2);
        border: 1px solid var(--line);
        color: var(--muted);
      }
    }

    .pager {
      display: flex; gap: 8px; justify-content: center; align-items: center; margin: 18px 0 40px;
      button {
        background: var(--panel2); border: 1px solid var(--line); color: var(--text);
        font-weight: 700; padding: 9px 15px; border-radius: 10px; cursor: pointer;
        &.cur { background: var(--accent); color: #1a1206; border-color: var(--accent); }
        &:disabled { opacity: 0.35; cursor: not-allowed; }
      }
    }

    .modal {
      max-width: 560px; margin: 0 auto;
      background: var(--panel); border: 1px solid var(--line);
      border-radius: 20px; padding: 26px 24px 22px; position: relative;
    }
    .modal-head {
      display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding-right: 36px;
      .sub { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
    }
    .m-close {
      position: absolute; top: 16px; right: 16px;
      background: var(--panel2); border: 1px solid var(--line); color: var(--muted);
      width: 34px; height: 34px; border-radius: 10px; cursor: pointer; font-size: 16px;
    }

    .tx-wrap { position: relative; min-height: 220px; }
    .tx-list { display: flex; flex-direction: column; gap: 8px; }
    .tx-list.blurred {
      filter: blur(7px);
      user-select: none;
      pointer-events: none;
      opacity: 0.72;
    }
    .tx-card {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 12px; border-radius: 14px;
      background: var(--panel2); border: 1px solid var(--line);
      &.buy { border-color: color-mix(in srgb, var(--up) 28%, var(--line)); }
      &.sell { border-color: color-mix(in srgb, var(--down) 28%, var(--line)); }
    }
    .side-pill {
      font-size: 11px; font-weight: 800; padding: 5px 9px; border-radius: 8px; letter-spacing: 0.2px;
      &.al { background: var(--up-bg); color: var(--up); }
      &.sat { background: var(--down-bg); color: var(--down); }
    }
    .tx-main {
      flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;
      b { font-size: 14px; }
    }
    .tx-sub { font-size: 11.5px; color: var(--muted); font-weight: 600; }
    .tx-price {
      font-size: 12.5px; font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .tx-when { font-size: 11.5px; color: var(--muted); white-space: nowrap; }

    .lock-overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 24px;
      background: color-mix(in srgb, var(--panel) 55%, transparent);
      border-radius: 16px;
    }
    .lock-icon { font-size: 36px; margin-bottom: 8px; }
    .lock-title { font-size: 16px; font-weight: 800; }
    .lock-text { margin: 6px 0 0; font-size: 13px; color: var(--muted); max-width: 280px; line-height: 1.45; }

    .detail-pager {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      margin-top: 14px; flex-wrap: wrap;
    }
    .pager-btn {
      background: var(--panel2); border: 1px solid var(--line);
      color: var(--text); border-radius: 10px; padding: 8px 12px;
      font-size: 12.5px; font-weight: 700; cursor: pointer;
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }
    .pager-meta { font-size: 12px; font-weight: 600; color: var(--muted); }

    @media (max-width: 600px) {
      .podium { grid-template-columns: 1fr; gap: 8px; }
      .ldr-nm { min-width: 90px; }
    }
  `,
})
export class LeaderboardPageComponent {
  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;
  readonly symbolColor = symbolColor;
  readonly medals = ['🥇', '🥈', '🥉'];

  readonly entries = buildLeaderboard();
  readonly page = signal(1);
  readonly pageSize = 7;
  readonly detail = signal<LeaderboardEntry | null>(null);
  readonly detailPage = signal(1);

  readonly weekLabel = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  readonly totalPages = Math.ceil(this.entries.length / this.pageSize);

  readonly podium = computed(() => this.entries.slice(0, 3));

  readonly pageEntries = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.entries.slice(start, start + this.pageSize);
  });

  readonly detailTotalPages = computed(() => {
    const d = this.detail();
    if (!d?.trades.length) return 0;
    return Math.ceil(d.trades.length / DETAIL_PAGE_SIZE);
  });

  readonly detailPageTrades = computed<LeaderTrade[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const start = (this.detailPage() - 1) * DETAIL_PAGE_SIZE;
    return d.trades.slice(start, start + DETAIL_PAGE_SIZE);
  });

  openDetail(entry: LeaderboardEntry): void {
    this.detailPage.set(1);
    this.detail.set(entry);
  }

  closeDetail(): void {
    this.detail.set(null);
  }
}
