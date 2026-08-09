import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TimeMachineCalc,
  TimeMachineDailyReport,
  TimeMachineLeader,
  TimeMachineLeaders,
} from '../../core/models/time-machine.model';
import { PARITY_ICONS, PARITY_LABELS, ParitySymbol } from '../../core/models/index.model';
import { ModalService } from '../../core/services/modal.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { UsStockApiService } from '../../core/services/us-stock-api.service';
import {
  formatInteger,
  formatMoneyAmount,
  formatNumber,
  formatTurkishDate,
  symbolColor,
} from '../../core/utils/format.util';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';
import { StockLogoComponent } from '../../shared/components/stock-logo/stock-logo.component';

type Market = 'bist' | 'crypto' | 'us';

interface MarketSection {
  key: Market;
  label: string;
  icon: string;
  gainers: TimeMachineLeader[];
  losers: TimeMachineLeader[];
}

/** sections() ve heroFromLeaders() aynı piyasa listesini paylaşır. */
const MARKET_META: { key: Market; label: string; icon: string }[] = [
  { key: 'bist', label: 'Borsa İstanbul', icon: '📈' },
  { key: 'crypto', label: 'Kripto', icon: '₿' },
  { key: 'us', label: 'ABD', icon: '🇺🇸' },
];

interface Hero {
  market: Market;
  marketLabel: string;
  marketIcon: string;
  leader: TimeMachineLeader;
}

@Component({
  selector: 'app-daily-report-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, DatePickerComponent, StockLogoComponent, FormsModule],
  template: `
    <app-overlay [open]="modals.active() === 'dailyReport'" (closed)="onClose()">
      <div class="modal">
        <button class="m-close" type="button" (click)="onClose()">✕</button>
        <h2>🍀 O Gün Ne Alsaydım Zengin Olurdum?</h2>
        <p class="sub">Bir tarih ve tutar seç — BIST, Kripto ve ABD'de o günden bugüne en çok kazandıran ve en çok kaybettiren enstrümanları görürsün.</p>

        <div class="inputs-row">
          <div class="tm-section">
            <div class="tm-label">TARİH SEÇ</div>
            <app-date-picker [(value)]="dateStr" maxDate="" />
          </div>

          <div class="tm-section amount-section">
            <div class="tm-label">TUTAR (₺)</div>
            <input
              class="amount-input"
              type="number"
              min="1"
              step="100"
              [ngModel]="amount()"
              (ngModelChange)="amount.set($event)"
            />
          </div>
        </div>

        <button class="calc-btn" type="button" (click)="onCalc()" [disabled]="loading()">
          {{ loading() ? 'Hesaplanıyor…' : 'Hesapla' }}
        </button>

        @if (loading()) {
          <div class="calc-loading">
            <div class="calc-loading-ring"></div>
            <div class="calc-loading-icons">
              <span>📈</span>
              <span>💰</span>
              <span>📊</span>
              <span>🚀</span>
            </div>
            <div class="calc-loading-text">Hesaplanıyor…</div>
          </div>
        } @else if (error()) {
          <p class="status error">{{ error() }}</p>
        } @else if (report(); as r) {
          @if (hero(); as h) {
            <p class="question">
              {{ formatTurkishDate(r.requestedDate) }} tarihinde {{ formatMoneyAmount(amount()) }} ₺ ile
              {{ displaySymbol(h.market, h.leader.symbol) }} alsaydım ne olurdu?
            </p>

            <div class="hero">
              <div class="hero-tag">🏆 KAZANAN</div>
              <div class="hero-body">
                <app-stock-logo [symbol]="h.leader.symbol" [color]="symbolColor(h.leader.symbol)" [market]="h.market" size="md" />
                <div class="hero-meta">
                  <div class="hero-sym">
                    {{ displaySymbol(h.market, h.leader.symbol) }}
                    <span class="hero-market">{{ h.marketIcon }} {{ h.marketLabel }}</span>
                  </div>
                  <div class="hero-pct">{{ pctText(h.leader.returnPct) }}</div>
                </div>
              </div>
              <div class="hero-bottom">
                <div class="hero-result">
                  <span class="hero-result-label">{{ formatMoneyAmount(amount()) }} ₺ →</span>
                  <span class="hero-result-value">{{ formatMoneyAmount(resultAmount(h.leader.returnPct)) }} ₺</span>
                </div>

                @if (heroCalcLoading()) {
                  <p class="hero-story-status">Hikaye hesaplanıyor…</p>
                } @else if (heroCalc(); as hc) {
                  <ul class="hero-story">
                    @for (line of hc.storyLines; track $index) {
                      <li>{{ line }}</li>
                    }
                  </ul>
                }
              </div>
            </div>

            <div class="share-row">
              <button class="share-btn" type="button" (click)="onShare(h)" [disabled]="sharing()">
                {{ sharing() ? 'Hazırlanıyor…' : '📤 Paylaş' }}
              </button>
              <button class="share-btn download" type="button" (click)="onDownload(h)" [disabled]="downloading()">
                {{ downloading() ? 'Hazırlanıyor…' : '⬇️ İndir' }}
              </button>
            </div>
          }

          @if (parity().length) {
            <div class="parity-row">
              @for (p of parity(); track p.symbol) {
                <div class="parity-chip" [class.down]="p.returnPct < 0">
                  <span class="parity-name">{{ parityIcon(p.symbol) }} {{ parityLabel(p.symbol) }}</span>
                  <span class="parity-tl mono">{{ formatMoneyAmount(resultAmount(p.returnPct)) }} ₺</span>
                  <span class="parity-pct">{{ pctText(p.returnPct) }}</span>
                </div>
              }
            </div>
          }

          <div class="sections">
            @for (section of sections(); track section.key) {
              <div class="section">
                <div class="section-head">
                  <span class="section-icon">{{ section.icon }}</span>
                  <b>{{ section.label }}</b>
                </div>

                <div class="cols">
                  <div class="col">
                    <div class="col-title up">🚀 Kazandıranlar</div>
                    @if (section.gainers.length) {
                      <ol class="list">
                        @for (l of section.gainers; track l.symbol) {
                          <li class="row">
                            <span class="rank">{{ l.rank }}</span>
                            <app-stock-logo [symbol]="l.symbol" [color]="symbolColor(l.symbol)" [market]="section.key" size="sm" />
                            <span class="sym">{{ displaySymbol(section.key, l.symbol) }}</span>
                            <span class="ret up">{{ pctText(l.returnPct) }}</span>
                            <span class="tl up mono">{{ formatMoneyAmount(resultAmount(l.returnPct)) }} ₺</span>
                          </li>
                        }
                      </ol>
                    } @else {
                      <p class="empty">Veri yok</p>
                    }
                  </div>

                  <div class="col">
                    <div class="col-title down">📉 Kaybettirenler</div>
                    @if (section.losers.length) {
                      <ol class="list">
                        @for (l of section.losers; track l.symbol) {
                          <li class="row">
                            <span class="rank">{{ l.rank }}</span>
                            <app-stock-logo [symbol]="l.symbol" [color]="symbolColor(l.symbol)" [market]="section.key" size="sm" />
                            <span class="sym">{{ displaySymbol(section.key, l.symbol) }}</span>
                            <span class="ret down">{{ pctText(l.returnPct) }}</span>
                            <span class="tl down mono">{{ formatMoneyAmount(resultAmount(l.returnPct)) }} ₺</span>
                          </li>
                        }
                      </ol>
                    } @else {
                      <p class="empty">Veri yok</p>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </app-overlay>
  `,
  styles: `
    .modal {
      max-width: 720px;
      margin: 0 auto;
      background: var(--panel);
      border-radius: 16px;
      padding: 24px;
      position: relative;
      max-height: 85vh;
      overflow-y: auto;
    }

    .m-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 18px;
      color: var(--muted);
      cursor: pointer;
      padding: 4px;
    }

    h2 {
      font-size: 18px;
      font-weight: 800;
      margin: 0 0 6px;
      padding-right: 24px;
    }

    .sub {
      font-size: 12.5px;
      color: var(--muted);
      margin: 0 0 18px;
      line-height: 1.5;
    }

    .inputs-row {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .inputs-row .tm-section { flex: 1; min-width: 0; }

    /* app-date-picker'ın tetikleyici düğmesi kendi bileşeninde stillenir (view
       encapsulation); tutar input'uyla aynı yükseklikte durması için burada
       ::ng-deep ile bu modalin kapsamına özel yeniden boyutlandırılır. */
    .inputs-row ::ng-deep .dp-trigger {
      height: 40px;
      box-sizing: border-box;
      padding-top: 0;
      padding-bottom: 0;
    }

    .tm-section { margin-bottom: 14px; }
    .tm-label {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .amount-input {
      width: 100%;
      box-sizing: border-box;
      height: 40px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel2, var(--panel));
      color: var(--text);
      font-size: 14px;
      font-weight: 700;
      font-family: inherit;

      &:focus { outline: none; border-color: var(--accent); }
      /* Tarayıcı spinner oklarını kaldır — sayısal input daha temiz görünür. */
      &::-webkit-inner-spin-button, &::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    }

    .calc-btn {
      width: 100%;
      height: 42px;
      margin-bottom: 18px;
      border: none;
      border-radius: 10px;
      background: linear-gradient(135deg, #7c4dff, #5e35b1);
      color: #fff;
      font-size: 13.5px;
      font-weight: 800;
      letter-spacing: 0.3px;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.15s;

      &:hover:not(:disabled) { transform: translateY(-1px); }
      &:disabled { opacity: 0.65; cursor: default; }
    }

    .question {
      font-size: 16px;
      font-weight: 800;
      line-height: 1.4;
      margin: 0 0 10px;
      color: var(--text);
    }

    .share-row {
      display: flex;
      gap: 10px;
      margin: -8px 0 16px;
    }

    .share-btn {
      flex: 1;
      height: 40px;
      border: 1px solid color-mix(in srgb, #7c4dff 45%, var(--line));
      border-radius: 10px;
      background: transparent;
      color: #b388ff;
      font-size: 12.5px;
      font-weight: 800;
      letter-spacing: 0.3px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover:not(:disabled) { background: color-mix(in srgb, #7c4dff 10%, transparent); }
      &:disabled { opacity: 0.6; cursor: default; }

      &.download {
        border-color: var(--line);
        color: var(--text);
        &:hover:not(:disabled) { background: color-mix(in srgb, var(--text) 6%, transparent); }
      }
    }

    /* Dolar/Euro/Gram Altın — sade, üç eş parçalı mini şerit. */
    .parity-row {
      display: flex;
      gap: 8px;
      margin: 0 0 12px;
    }

    .parity-chip {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 6px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--panel2, var(--panel));
    }

    .parity-name {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.2px;
      color: var(--muted);
      white-space: nowrap;
    }

    .parity-tl {
      font-size: 12.5px;
      font-weight: 800;
      color: var(--up);
    }
    .parity-chip.down .parity-tl { color: var(--down); }

    .parity-pct {
      font-size: 10px;
      font-weight: 600;
      color: var(--muted);
    }

    .hero {
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 18px;
      background: linear-gradient(135deg, color-mix(in srgb, #7c4dff 16%, var(--panel)), color-mix(in srgb, #7c4dff 4%, var(--panel)));
      border: 1px solid color-mix(in srgb, #7c4dff 45%, var(--line));
    }

    .hero-tag {
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.6px;
      color: #b388ff;
      margin-bottom: 10px;
    }

    .hero-body {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .hero-meta { min-width: 0; flex: 1; }

    .hero-sym {
      font-size: 16px;
      font-weight: 800;
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }

    .hero-market {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
    }

    .hero-pct {
      font-size: 14px;
      font-weight: 700;
      color: var(--up);
      margin-top: 2px;
    }

    .hero-bottom {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid color-mix(in srgb, #7c4dff 25%, var(--line));
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    /* Sonuç solda sabit genişlikte, hikaye sağdaki kalan alanı doldurur. */
    .hero-result { flex: none; }
    .hero-story, .hero-story-status { flex: 1; min-width: 0; }

    @media (max-width: 560px) {
      .hero-bottom { flex-direction: column; gap: 10px; }
    }

    .hero-result {
      display: flex;
      align-items: baseline;
      gap: 6px;
      flex-wrap: wrap;
    }

    .hero-result-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text);
    }

    .hero-result-value {
      font-size: 26px;
      font-weight: 900;
      color: var(--up);
      letter-spacing: -0.2px;
    }

    .hero-story {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .hero-story li {
      font-size: 11px;
      line-height: 1.5;
      color: var(--muted);
    }

    .hero-story-status {
      font-size: 11px;
      color: var(--muted);
      margin: 0;
    }

    .status {
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      padding: 24px 0;
    }
    .status.error { color: var(--down); }

    /* Hesaplanıyor ekranı — dönen bir halka + sırayla zıplayan borsa ikonları. */
    .calc-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      padding: 40px 0 32px;
    }

    .calc-loading-ring {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: 3px solid color-mix(in srgb, #7c4dff 20%, transparent);
      border-top-color: #7c4dff;
      animation: cl-spin 0.9s linear infinite;
    }

    .calc-loading-icons {
      display: flex;
      gap: 16px;
      margin-top: -4px;
    }
    .calc-loading-icons span {
      font-size: 26px;
      display: inline-block;
      animation: cl-bounce 1.2s ease-in-out infinite;
    }
    .calc-loading-icons span:nth-child(1) { animation-delay: 0s; }
    .calc-loading-icons span:nth-child(2) { animation-delay: 0.15s; }
    .calc-loading-icons span:nth-child(3) { animation-delay: 0.3s; }
    .calc-loading-icons span:nth-child(4) { animation-delay: 0.45s; }

    .calc-loading-text {
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.3px;
      color: var(--muted);
      animation: cl-fade 1.4s ease-in-out infinite;
    }

    @keyframes cl-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes cl-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-9px); opacity: 1; }
    }
    @keyframes cl-fade {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .calc-loading-ring, .calc-loading-icons span, .calc-loading-text { animation: none; }
    }

    .sections {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
    }

    /* Hero'dan sonra bu bölümler bilinçli olarak sade: ince çerçeve, az iç boşluk,
       birbirine yakın (gap 6px) — dikkat hero karttan kaçmasın. */
    .section {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 12px;
    }

    .section-head {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      margin-bottom: 8px;
      opacity: 0.85;
    }
    .section-icon { font-size: 13px; }

    .cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    @media (max-width: 560px) {
      .cols { grid-template-columns: 1fr; }
    }

    .col-title {
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .col-title.up { color: var(--up); }
    .col-title.down { color: var(--down); }

    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 11.5px;
    }

    .rank {
      flex: none;
      width: 16px;
      color: var(--muted);
      font-weight: 700;
      font-size: 11px;
    }

    /* Sembol içeriğine göre daralır — yüzdenin hemen yanında durabilsin diye artık
       satırı esnetip diğer her şeyi sağa itmiyor (eskiden .sym{flex:1} yüzdeyi de
       tutarı da sağ kenara yapıştırıyordu, ikisi arasında büyük boşluk kalıyordu). */
    .sym {
      flex: 0 1 auto;
      min-width: 0;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Yüzde artık hissenin hemen yanında — ikincil ama okunaklı. */
    .ret {
      flex: none;
      font-weight: 700;
      font-size: 11px;
      opacity: 0.9;
    }
    .ret.up { color: var(--up); }
    .ret.down { color: var(--down); }

    /* TL tutarı satırın en sağına yaslanır — asıl vurgu burada. */
    .tl {
      flex: none;
      margin-left: auto;
      color: var(--muted);
      font-size: 10.5px;
      min-width: 56px;
      text-align: right;
    }
    .tl.up {
      font-size: 13px;
      font-weight: 800;
      color: var(--up);
    }
    .tl.down {
      font-size: 13px;
      font-weight: 800;
      color: var(--down);
    }

    .empty {
      font-size: 12px;
      color: var(--muted);
      margin: 0;
    }

    .note {
      margin-top: 16px;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.5;
    }
  `,
})
export class DailyReportModalComponent {
  readonly modals = inject(ModalService);
  private readonly api = inject(StockApiService);
  private readonly usStockApi = inject(UsStockApiService);

  readonly formatTurkishDate = formatTurkishDate;
  readonly formatMoneyAmount = formatMoneyAmount;
  readonly symbolColor = symbolColor;

  readonly dateStr = signal('');
  readonly amount = signal(1000);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly report = signal<TimeMachineDailyReport | null>(null);
  readonly heroCalc = signal<TimeMachineCalc | null>(null);
  readonly heroCalcLoading = signal(false);
  readonly sharing = signal(false);
  readonly downloading = signal(false);
  readonly parity = signal<TimeMachineLeader[]>([]);

  readonly sections = computed<MarketSection[]>(() => {
    const r = this.report();
    if (!r) return [];
    const rows: Record<Market, TimeMachineDailyReport['bist']> = { bist: r.bist, crypto: r.crypto, us: r.usStocks };
    return MARKET_META.map((m) => ({ ...m, gainers: rows[m.key].gainers, losers: rows[m.key].losers }));
  });

  /** BIST/Kripto/ABD kazananları arasından tek en iyi sonuç — hero kart için. */
  readonly hero = computed<Hero | null>(() => {
    const candidates: Hero[] = this.sections()
      .filter((s) => s.gainers.length > 0)
      .map((s) => ({
        market: s.key,
        marketLabel: s.label,
        marketIcon: s.icon,
        leader: s.gainers[0],
      }));
    if (!candidates.length) return null;
    return candidates.reduce((best, c) => (c.leader.returnPct > best.leader.returnPct ? c : best));
  });

  /**
   * `hero` computed'ı gibi ama report() değil, doğrudan leaders() yanıtından (bist/crypto/
   * usStocks dizilerinin ilk elemanı = rank 1) kazananı belirler. leaders zaten her kategorinin
   * en iyisini içeriyor, bu yüzden kazananı bulmak için ayrıca report'un dönmesini beklemeye
   * gerek yok — hikaye isteği report ile TAM PARALEL, hemen başlayabilir.
   */
  private heroFromLeaders(leaders: TimeMachineLeaders | null): Hero | null {
    if (!leaders) return null;
    const rows: Record<Market, TimeMachineLeader[]> = {
      bist: leaders.bist,
      crypto: leaders.crypto,
      us: leaders.usStocks,
    };
    const candidates: Hero[] = MARKET_META
      .filter((m) => rows[m.key]?.length > 0)
      .map((m) => ({ market: m.key, marketLabel: m.label, marketIcon: m.icon, leader: rows[m.key][0] }));
    if (!candidates.length) return null;
    return candidates.reduce((best, c) => (c.leader.returnPct > best.leader.returnPct ? c : best));
  }

  constructor() {
    effect(() => {
      const open = this.modals.active() === 'dailyReport';
      if (!open) return;
      // Sadece varsayılan tarihi hazırla — Hesapla'ya basılmadan hiçbir sorgu atılmaz.
      if (!this.dateStr()) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 10);
        this.dateStr.set(d.toISOString().slice(0, 10));
      }
    });
  }

  onCalc(): void {
    const iso = this.dateStr();
    if (!iso || iso.length < 10) return;
    this.fetch(iso);
  }

  private fetch(iso: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.heroCalc.set(null);
    this.heroCalcLoading.set(true);
    this.parity.set([]);

    // Rapor (tablolar) ve liderler (parite) tam paralel atılıyor, kazananın hikayesi de
    // ikisini YARIŞTIRIR (hangisi önce "kazanan kim"i verirse hikaye o an başlar) — bu hâlâ
    // en hızlı yol. Ama yükleniyor ekranı artık SADECE rapor gelince değil, hikaye de (varsa)
    // tamamen bitince kapanıyor — kullanıcı isteği: her şey ayrı ayrı belirmesin, komple gelsin.
    let heroStoryStarted = false;
    let heroStoryDone = false;
    let leadersSettled = false;
    let reportSettled = false;
    let latestLeaders: TimeMachineLeaders | null = null;

    const finishIfEverythingReady = () => {
      if (!reportSettled) return;
      const h = this.hero();
      if (h && !heroStoryDone) return;
      this.loading.set(false);
    };

    const tryStartHeroStory = (h: Hero | null, leaders: TimeMachineLeaders | null) => {
      if (heroStoryStarted || !h) return;
      if (h.market !== 'bist' && !leaders) return; // kripto/ABD: parite (USD/TRY) şart, bekle
      heroStoryStarted = true;
      this.fetchHeroStory(h, iso, leaders, () => {
        heroStoryDone = true;
        finishIfEverythingReady();
      });
    };

    const giveUpIfNothingFound = () => {
      if (!heroStoryStarted && leadersSettled && reportSettled) {
        this.heroCalcLoading.set(false);
        heroStoryDone = true;
        finishIfEverythingReady();
      }
    };

    this.api.getTimeMachineLeaders(iso).subscribe({
      next: (leaders) => {
        latestLeaders = leaders;
        this.parity.set(leaders?.parity ?? []);
        tryStartHeroStory(this.heroFromLeaders(leaders), leaders);
      },
      error: () => {
        leadersSettled = true;
        giveUpIfNothingFound();
      },
      complete: () => {
        leadersSettled = true;
        giveUpIfNothingFound();
      },
    });

    this.api.getTimeMachineDailyReport(iso).subscribe({
      next: (report) => {
        this.report.set(report);
        reportSettled = true;
        tryStartHeroStory(this.hero(), latestLeaders);
        giveUpIfNothingFound();
        finishIfEverythingReady();
      },
      error: () => {
        this.error.set('Hesaplanamadı. Backend bağlantısını kontrol et.');
        this.loading.set(false);
        reportSettled = true;
      },
    });
  }

  /**
   * Kazanan kart için kısa "hikaye" — tek-hisse zaman makinesi simülasyonunun
   * storyLines'ı (kaç lot alındı, bedelli/bedelsiz, temettü, güncel değer) aynen kullanılır.
   * Kripto/ABD, API'den USD tutar beklediği için o günün USD/TRY kuruyla çevrilir
   * (time-machine-modal'daki toTryCalc ile aynı mantık). `leaders` fetch()'te zaten
   * çekildiği için burada tekrar istek atılmıyor.
   */
  private fetchHeroStory(h: Hero, iso: string, leaders: TimeMachineLeaders | null, onDone?: () => void): void {
    this.heroCalcLoading.set(true);
    const amountTry = this.amount();

    if (h.market === 'bist') {
      this.api.calculateTimeMachine(h.leader.symbol, iso, 50, 'lump', amountTry, 'bist').subscribe({
        next: (r) => {
          this.heroCalc.set(r);
          this.heroCalcLoading.set(false);
          onDone?.();
        },
        error: () => {
          this.heroCalcLoading.set(false);
          onDone?.();
        },
      });
      return;
    }

    const row = leaders?.parity?.find((p) => p.symbol === 'USDTRY');
    if (!row || row.startPrice <= 0 || row.endPrice <= 0) {
      this.heroCalcLoading.set(false);
      onDone?.();
      return;
    }
    const usdStart = row.startPrice;
    const usdEnd = row.endPrice;
    const amountUsd = amountTry / usdStart;
    const result$ =
      h.market === 'us'
        ? this.usStockApi.calculateTimeMachine(h.leader.symbol, iso, 'lump', amountUsd)
        : this.api.calculateTimeMachine(h.leader.symbol, iso, 50, 'lump', amountUsd, 'crypto');
    result$.subscribe({
      next: (r) => {
        this.heroCalc.set({
          ...r,
          invested: amountTry,
          currentValue: r.currentValue * usdEnd,
          dividendsReceived: r.dividendsReceived * usdEnd,
          dividendsReinvested: r.dividendsReinvested * usdEnd,
          cashRemaining: r.cashRemaining * usdEnd,
        });
        this.heroCalcLoading.set(false);
        onDone?.();
      },
      error: () => {
        this.heroCalcLoading.set(false);
        onDone?.();
      },
    });
  }

  parityIcon(symbol: string): string {
    return PARITY_ICONS[symbol as ParitySymbol] ?? '💱';
  }

  parityLabel(symbol: string): string {
    return PARITY_LABELS[symbol as ParitySymbol] ?? symbol;
  }

  displaySymbol(market: Market, symbol: string): string {
    if (market !== 'crypto') return symbol;
    return symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
  }

  pctText(pct: number): string {
    const sign = pct >= 0 ? '+' : '';
    return Math.abs(pct) >= 1000 ? `${sign}%${formatInteger(pct)}` : `${sign}%${formatNumber(pct)}`;
  }

  /**
   * TL sonucu returnPct'ten türetilir — backend'in `multiple` alanı ham (bölünme/temettü
   * düzeltilmemiş) fiyat oranıdır ve büyük sermaye artırımı geçirmiş hisselerde returnPct
   * (AdjustedClose bazlı, gösterilen yüzdeyle aynı) ile çelişebiliyordu (ör. "+%132" yanında
   * küçülmüş bir tutar). Aynı sayıdan türetildiği için yüzde ile tutar artık her zaman tutarlı.
   */
  resultAmount(returnPct: number): number {
    return this.amount() * (1 + returnPct / 100);
  }

  onClose(): void {
    this.modals.close();
    // Bir dahaki açılışta Hesapla'ya basılana kadar sonuç alanı boş kalsın.
    this.report.set(null);
    this.heroCalc.set(null);
    this.error.set(null);
    this.parity.set([]);
  }

  private async getShareBlob(h: Hero): Promise<Blob | null> {
    const canvas = this.buildShareCanvas(h);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  private shareMeta(h: Hero): { fileName: string; text: string } {
    const displaySym = this.displaySymbol(h.market, h.leader.symbol);
    return {
      fileName: `sanalportfoy-zengin-testi-${displaySym}.png`,
      text:
        `${this.formatTurkishDate(this.dateStr())} tarihinde ${this.formatMoneyAmount(this.amount())} ₺ ile ` +
        `${displaySym} alsaydım ne olurdu? 🏆 sanalportfoy.com`,
    };
  }

  /**
   * Cihaz destekliyorsa native paylaşım sayfasını açar — mobilde bu sayfanın içinde zaten
   * "Resimlere Kaydet" gibi bir kaydetme seçeneği de bulunur (ayrı bir İndir butonuna gerek
   * yok), ayrıca WhatsApp/Instagram/Twitter/Facebook da mobilde bu listede çıkar. Kullanıcı
   * sayfayı kapatır/iptal ederse (AbortError) hiçbir şey yapmaz. Paylaşım TAMAMEN
   * desteklenmiyorsa (ör. bazı masaüstü tarayıcılar) — bu bir iptal değil, bir yetenek eksikliği
   * olduğu için — görsel otomatik indirilir; kullanıcının elde etmesinin tek yolu budur.
   */
  async onShare(h: Hero): Promise<void> {
    if (this.sharing()) return;
    this.sharing.set(true);
    try {
      const blob = await this.getShareBlob(h);
      if (!blob) return;

      const { fileName, text } = this.shareMeta(h);
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (data?: { files?: File[] }) => boolean };

      if (!nav.share || !nav.canShare?.({ files: [file] })) {
        this.downloadBlob(blob, fileName);
        return;
      }

      try {
        await nav.share({ files: [file], title: 'Sanal Portföy — Zengin Testi', text });
      } catch {
        // Kullanıcı paylaşım sayfasını kapattı/iptal etti — bilinçli bir seçim, hiçbir şey yapma.
      }
    } finally {
      this.sharing.set(false);
    }
  }

  /** Masaüstünde native paylaşım listesinde "Kaydet" çıkmadığından, ayrı ve her zaman
   *  çalışan bir indirme yolu — Paylaş'ın davranışına bağlı değil. */
  async onDownload(h: Hero): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(true);
    try {
      const blob = await this.getShareBlob(h);
      if (!blob) return;
      const { fileName } = this.shareMeta(h);
      this.downloadBlob(blob, fileName);
    } finally {
      this.downloading.set(false);
    }
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Mini bölümlerdeki tek satır: sembol + yüzde solda bitişik, TL tutarı sütunun sağına yaslı. */
  private drawMiniLeaderRow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    l: TimeMachineLeader,
    market: Market,
    positive: boolean,
    font: string,
  ): void {
    const color = positive ? '#22c98a' : '#f0506e';
    const sym = this.displaySymbol(market, l.symbol);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8edf6';
    ctx.font = `700 21px ${font}`;
    ctx.fillText(sym, x, y);
    const symW = ctx.measureText(sym).width;

    ctx.fillStyle = color;
    ctx.font = `600 15px ${font}`;
    ctx.fillText(this.pctText(l.returnPct), x + symW + 10, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = `800 19px ${font}`;
    ctx.fillText(`${this.formatMoneyAmount(this.resultAmount(l.returnPct))} ₺`, x + width, y);
    ctx.textAlign = 'left';
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    const anyCtx = ctx as CanvasRenderingContext2D & { roundRect?: (...a: number[]) => void };
    if (typeof anyCtx.roundRect === 'function') {
      anyCtx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /**
   * İçerik kısaysa (hikaye satırı azsa) sabit 1920px'lik kart altta boş kalıyordu.
   * Önce boyutsuz bir ölçüm geçişiyle gerçek içerik yüksekliği bulunur, sonra karta
   * göre boyutlanmış gerçek canvas'a aynı çizim tekrar uygulanır (iki geçiş de ucuz).
   */
  private buildShareCanvas(h: Hero): HTMLCanvasElement {
    // Ölçüm geçişinde canvas'ın kendi yüksekliği hiç önemli değil (piksel okunmuyor,
    // sadece metin genişlikleri ölçülüyor) — bol payla kurup gerçek footer'ı hiç
    // kırpmadan (H-60 kelepçesi devreye girmeden) doğru içerik yüksekliğini buluyoruz.
    const probe = document.createElement('canvas');
    probe.width = 1080;
    probe.height = 4000;
    const contentBottom = this.paintShareCard(probe, h);

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = Math.min(2800, Math.max(1280, Math.round(contentBottom) + 200));
    this.paintShareCard(canvas, h);
    return canvas;
  }

  /** Kart içeriğini verilen canvas'a çizer, içeriğin bittiği son y konumunu döner. */
  private paintShareCard(canvas: HTMLCanvasElement, h: Hero): number {
    const FONT = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    const W = canvas.width;
    const H = canvas.height;
    const PAD = 72;
    const CW = W - PAD * 2;

    const ctx = canvas.getContext('2d')!;

    // Arka plan — koyu, marka moru glow'lu (temadan bağımsız, her zaman aynı görünür).
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b0f1a');
    bg.addColorStop(1, '#1a1030');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, 820, 40, W / 2, 820, 680);
    glow.addColorStop(0, 'rgba(124,77,255,0.32)');
    glow.addColorStop(1, 'rgba(124,77,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    let y = 150;

    // Marka: logo kutusu + "Sanal Portföy" + "sanalportfoy.com" (sol üst, header'daki
    // marka simgesiyle aynı bar-grafik + ok motifi).
    const logoSize = 84;
    const logoGrad = ctx.createLinearGradient(PAD, y, PAD + logoSize, y + logoSize);
    logoGrad.addColorStop(0, '#f5b944');
    logoGrad.addColorStop(1, '#e8632c');
    this.roundRect(ctx, PAD, y, logoSize, logoSize, 20);
    ctx.fillStyle = logoGrad;
    ctx.fill();

    ctx.fillStyle = 'rgba(11,15,26,0.85)';
    const bx = PAD + 16;
    const baseline = y + logoSize - 16;
    this.roundRect(ctx, bx, baseline - 20, 12, 20, 3);
    ctx.fill();
    this.roundRect(ctx, bx + 20, baseline - 34, 12, 34, 3);
    ctx.fill();
    this.roundRect(ctx, bx + 40, baseline - 50, 12, 50, 3);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8edf6';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('Sanal Portföy', PAD + logoSize + 22, y + 44);
    ctx.fillStyle = '#8593ad';
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText('sanalportfoy.com', PAD + logoSize + 22, y + 78);

    y += logoSize + 96;

    // Soru başlığı — vurgulu.
    const amountLabel = this.formatMoneyAmount(this.amount());
    const dateLabel = this.formatTurkishDate(this.dateStr());
    ctx.fillStyle = '#f5f7fb';
    ctx.font = `800 54px ${FONT}`;
    const displaySymForQuestion = this.displaySymbol(h.market, h.leader.symbol);
    const qLines = this.wrapLines(
      ctx,
      `${dateLabel} tarihinde ${amountLabel} ₺ ile ${displaySymForQuestion} alsaydım ne olurdu?`,
      CW,
    );
    for (const line of qLines) {
      y += 64;
      ctx.fillText(line, PAD, y);
    }

    y += 76;

    // KAZANAN etiketi.
    ctx.fillStyle = '#b388ff';
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText('🏆 KAZANAN', PAD, y);
    y += 60;

    // Kazanan: harf rozeti + sembol + piyasa + %.
    const circleR = 56;
    const circleCy = y + circleR - 12;
    ctx.beginPath();
    ctx.arc(PAD + circleR, circleCy, circleR, 0, Math.PI * 2);
    ctx.fillStyle = this.symbolColor(h.leader.symbol);
    ctx.fill();

    const displaySym = this.displaySymbol(h.market, h.leader.symbol);
    ctx.fillStyle = '#fff';
    ctx.font = `800 38px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(displaySym.slice(0, 2).toUpperCase(), PAD + circleR, circleCy + 13);
    ctx.textAlign = 'left';

    const symX = PAD + circleR * 2 + 34;
    ctx.fillStyle = '#f5f7fb';
    ctx.font = `800 50px ${FONT}`;
    ctx.fillText(displaySym, symX, y + 38);

    ctx.fillStyle = '#8593ad';
    ctx.font = `600 27px ${FONT}`;
    ctx.fillText(`${h.marketIcon} ${h.marketLabel}`, symX, y + 76);

    ctx.fillStyle = '#22c98a';
    ctx.font = `800 33px ${FONT}`;
    ctx.fillText(this.pctText(h.leader.returnPct), symX, y + 113);

    y += circleR * 2 + 30;

    // Ayraç.
    ctx.strokeStyle = 'rgba(124,77,255,0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();

    y += 74;

    // Sonuç — asıl vurgu: büyük, yeşil.
    ctx.fillStyle = '#e8edf6';
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText(`${amountLabel} ₺ →`, PAD, y);
    y += 106;

    ctx.fillStyle = '#22c98a';
    ctx.font = `900 92px ${FONT}`;
    const resultLabel = `${this.formatMoneyAmount(this.resultAmount(h.leader.returnPct))} ₺`;
    if (ctx.measureText(resultLabel).width > CW) {
      ctx.font = `900 68px ${FONT}`;
    }
    ctx.fillText(resultLabel, PAD, y);
    y += 76;

    // Kısa hikaye (varsa) — lot/bedelli-bedelsiz/temettü/güncel değer özeti.
    const storyLines = this.heroCalc()?.storyLines ?? [];
    if (storyLines.length) {
      ctx.fillStyle = '#a3adc2';
      ctx.font = `500 27px ${FONT}`;
      for (const line of storyLines) {
        for (const wrapped of this.wrapLines(ctx, line, CW)) {
          y += 40;
          ctx.fillText(wrapped, PAD, y);
        }
        y += 8;
      }
    }

    // Alt 4 alan (parite + BIST/Kripto/ABD) — minimalist, hero'nun altında bir özet.
    // Asıl odak yukarıdaki kazanan kaldığı için burada küçük punto ve az boşluk kullanılıyor.
    const parityRows = this.parity();
    const miniSections = this.sections().filter((s) => s.gainers.length || s.losers.length);

    if (parityRows.length || miniSections.length) {
      y += 34;
      ctx.strokeStyle = 'rgba(124,77,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(W - PAD, y);
      ctx.stroke();
      y += 50;
    }

    if (parityRows.length) {
      const gap = 12;
      const chipW = (CW - gap * (parityRows.length - 1)) / parityRows.length;
      const chipH = 96;
      let cx = PAD;
      for (const p of parityRows) {
        const up = p.returnPct >= 0;
        this.roundRect(ctx, cx, y, chipW, chipH, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();
        this.roundRect(ctx, cx, y, chipW, chipH, 12);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#8593ad';
        ctx.font = `700 19px ${FONT}`;
        ctx.fillText(`${this.parityIcon(p.symbol)} ${this.parityLabel(p.symbol)}`, cx + chipW / 2, y + 30);

        ctx.fillStyle = up ? '#22c98a' : '#f0506e';
        ctx.font = `800 23px ${FONT}`;
        ctx.fillText(`${this.formatMoneyAmount(this.resultAmount(p.returnPct))} ₺`, cx + chipW / 2, y + 64);

        ctx.font = `600 16px ${FONT}`;
        ctx.fillText(this.pctText(p.returnPct), cx + chipW / 2, y + 86);

        ctx.textAlign = 'left';
        cx += chipW + gap;
      }
      y += chipH + 46;
    }

    for (const section of miniSections) {
      ctx.fillStyle = '#e8edf6';
      ctx.font = `800 27px ${FONT}`;
      ctx.fillText(`${section.icon} ${section.label}`, PAD, y);
      y += 40;

      const colGap = 32;
      const colW = (CW - colGap) / 2;
      const gainersX = PAD;
      const losersX = PAD + colW + colGap;

      ctx.font = `700 17px ${FONT}`;
      ctx.fillStyle = '#22c98a';
      ctx.fillText('🚀 Kazandıranlar', gainersX, y);
      ctx.fillStyle = '#f0506e';
      ctx.fillText('📉 Kaybettirenler', losersX, y);
      y += 34;

      const rows = Math.min(3, Math.max(section.gainers.length, section.losers.length));
      for (let i = 0; i < rows; i++) {
        const rowY = y + i * 34;
        if (section.gainers[i]) {
          this.drawMiniLeaderRow(ctx, gainersX, rowY, colW, section.gainers[i], section.key, true, FONT);
        }
        if (section.losers[i]) {
          this.drawMiniLeaderRow(ctx, losersX, rowY, colW, section.losers[i], section.key, false, FONT);
        }
      }
      y += rows * 34 + 30;
    }

    // Alt çağrı — içerikten hemen sonra biraz boşluk bırakılarak (kartın en altına
    // sabitlenmez, aksi halde kısa hikayelerde ortada büyük bir boşluk kalıyordu).
    const footerY = y + 96;
    ctx.fillStyle = '#f5b944';
    ctx.font = `800 32px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('sanalportfoy.com’da sen de dene →', W / 2, Math.min(footerY, H - 60));
    ctx.textAlign = 'left';

    return footerY + 30;
  }
}
