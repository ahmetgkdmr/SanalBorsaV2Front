import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeaderboardEntry, PublicTrade } from '../../core/models/leaderboard.model';
import { LeaderboardApiService } from '../../core/services/leaderboard-api.service';
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
            <div class="av" [style.background]="symbolColor(p.username)">{{ p.username.slice(0, 2).toUpperCase() }}</div>
            <div class="nm">{{ p.username }}</div>
            <div class="gain">+%{{ formatNumber(p.gainPct) }}</div>
            <div class="pv mono">{{ formatInteger(p.portfolioValue) }} ₺</div>
          </div>
        }
      </div>

      <div class="sec-h">SIRALAMA</div>

      @if (loading()) {
        <p class="state-msg">Sıralama yükleniyor…</p>
      } @else if (error(); as err) {
        <p class="state-msg error">{{ err }}</p>
      } @else if (!entries().length) {
        <p class="state-msg">Henüz sıralamaya girecek bir portföy yok. İlk işlemini yapan sen ol!</p>
      }
      @for (e of pageEntries(); track e.username) {
        <div class="ldr-row">
          <span class="ldr-rank">#{{ e.rank }}</span>
          <div class="ldr-av" [style.background]="symbolColor(e.username)">{{ e.username.slice(0, 2).toUpperCase() }}</div>
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
        <button type="button" [disabled]="page() >= totalPages()" (click)="page.set(page() + 1)">→</button>
      </div>
    </section>

    <app-overlay [open]="!!detail()" (closed)="closeDetail()">
      @if (detail(); as d) {
        <div class="modal">
          <button class="m-close" type="button" (click)="closeDetail()">✕</button>
          <div class="modal-head">
            <div class="av big" [style.background]="symbolColor(d.username)">{{ d.username.slice(0, 2).toUpperCase() }}</div>
            <div>
              <h2>{{ d.username }}</h2>
              <p class="sub">İşlem geçmişi · #{{ d.rank }}</p>
            </div>
          </div>

          <div class="tx-wrap" [class.private]="!d.tradeHistoryPublic">
            <div class="tx-list" [class.blurred]="!d.tradeHistoryPublic">
              @for (t of detailPageTrades(); track t.executedAt + t.symbol + t.side + t.quantity) {
                <div class="tx-card" [class.buy]="t.side === 'BUY'" [class.sell]="t.side === 'SELL'">
                  <span class="side-pill" [class.al]="t.side === 'BUY'" [class.sat]="t.side === 'SELL'">
                    {{ t.side === 'BUY' ? '🟢 AL' : '🔴 SAT' }}
                  </span>
                  <app-stock-logo
                    [symbol]="t.symbol"
                    [color]="symbolColor(t.symbol)"
                    [market]="t.marketType"
                    size="sm"
                  />
                  <div class="tx-main">
                    <b>{{ t.symbol }}</b>
                    <span class="tx-sub mono">{{ formatNumber(t.quantity) }} lot</span>
                  </div>
                  @if (t.price != null) {
                    <span class="tx-price mono">{{ formatNumber(t.price) }} ₺</span>
                  }
                  <span class="tx-when">{{ t.executedAt | date: 'dd.MM.yyyy' }}</span>
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
                · {{ detailTrades().length }} işlem
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
  styleUrl: './leaderboard.page.css',
})
export class LeaderboardPageComponent implements OnInit {
  private readonly api = inject(LeaderboardApiService);

  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;
  readonly symbolColor = symbolColor;
  readonly medals = ['🥇', '🥈', '🥉'];

  readonly entries = signal<LeaderboardEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly page = signal(1);
  readonly pageSize = 7;

  readonly detail = signal<LeaderboardEntry | null>(null);
  readonly detailPage = signal(1);
  /** Detay modalı açılınca ayrı uçtan çekilir — liste yanıtı işlem taşımıyor. */
  readonly detailTrades = signal<PublicTrade[]>([]);
  readonly detailLoading = signal(false);

  readonly weekLabel = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.entries().length / this.pageSize)),
  );

  readonly podium = computed(() => this.entries().slice(0, 3));

  readonly pageEntries = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.entries().slice(start, start + this.pageSize);
  });

  readonly detailTotalPages = computed(() =>
    Math.ceil(this.detailTrades().length / DETAIL_PAGE_SIZE),
  );

  readonly detailPageTrades = computed<PublicTrade[]>(() => {
    const start = (this.detailPage() - 1) * DETAIL_PAGE_SIZE;
    return this.detailTrades().slice(start, start + DETAIL_PAGE_SIZE);
  });

  ngOnInit(): void {
    this.api.getLeaderboard(50).subscribe({
      next: (r) => {
        this.entries.set(r.entries);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Sıralama yüklenemedi. Bağlantını kontrol edip tekrar dene.');
        this.loading.set(false);
      },
    });
  }

  openDetail(entry: LeaderboardEntry): void {
    this.detailPage.set(1);
    this.detailTrades.set([]);
    this.detail.set(entry);

    // Gizliliği kapalı olan için istek atmaya gerek yok; sunucu zaten boş dönerdi.
    if (!entry.tradeHistoryPublic) return;

    this.detailLoading.set(true);
    this.api.getPublicTrades(entry.username).subscribe({
      next: (r) => {
        this.detailTrades.set(r.trades);
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });
  }

  closeDetail(): void {
    this.detail.set(null);
    this.detailTrades.set([]);
  }
}
