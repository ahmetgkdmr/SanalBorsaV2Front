import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { TimeMachineDailyReport, TimeMachineLeader } from '../../core/models/time-machine.model';
import { ModalService } from '../../core/services/modal.service';
import { StockApiService } from '../../core/services/stock-api.service';
import {
  formatInteger,
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

@Component({
  selector: 'app-daily-report-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, DatePickerComponent, StockLogoComponent],
  template: `
    <app-overlay [open]="modals.active() === 'dailyReport'" (closed)="onClose()">
      <div class="modal">
        <button class="m-close" type="button" (click)="onClose()">✕</button>
        <h2>🍀 O Gün Ne Alsaydım Zengin Olurdum?</h2>
        <p class="sub">Sadece bir tarih seç — BIST, Kripto ve ABD'de o günden bugüne en çok kazandıran ve en çok kaybettiren 3'er enstrümanı görürsün.</p>

        <div class="tm-section">
          <div class="tm-label">TARİH SEÇ</div>
          <app-date-picker [(value)]="dateStr" maxDate="" />
        </div>

        @if (loading()) {
          <p class="status">Hesaplanıyor…</p>
        } @else if (error()) {
          <p class="status error">{{ error() }}</p>
        } @else if (report(); as r) {
          <div class="sections">
            @for (section of sections(); track section.key) {
              <div class="section">
                <div class="section-head">
                  <span class="section-icon">{{ section.icon }}</span>
                  <b>{{ section.label }}</b>
                </div>

                <div class="cols">
                  <div class="col">
                    <div class="col-title up">🚀 En çok kazandıranlar</div>
                    @if (section.gainers.length) {
                      <ol class="list">
                        @for (l of section.gainers; track l.symbol) {
                          <li class="row">
                            <span class="rank">{{ l.rank }}</span>
                            <app-stock-logo [symbol]="l.symbol" [color]="symbolColor(l.symbol)" [market]="section.key" size="sm" />
                            <span class="sym">{{ displaySymbol(section.key, l.symbol) }}</span>
                            <span class="ret up">{{ pctText(l.returnPct) }}</span>
                            <span class="mult mono">{{ multipleText(l.multiple) }}</span>
                          </li>
                        }
                      </ol>
                    } @else {
                      <p class="empty">Veri yok</p>
                    }
                  </div>

                  <div class="col">
                    <div class="col-title down">📉 En çok kaybettirenler</div>
                    @if (section.losers.length) {
                      <ol class="list">
                        @for (l of section.losers; track l.symbol) {
                          <li class="row">
                            <span class="rank">{{ l.rank }}</span>
                            <app-stock-logo [symbol]="l.symbol" [color]="symbolColor(l.symbol)" [market]="section.key" size="sm" />
                            <span class="sym">{{ displaySymbol(section.key, l.symbol) }}</span>
                            <span class="ret down">{{ pctText(l.returnPct) }}</span>
                            <span class="mult mono">{{ multipleText(l.multiple) }}</span>
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

          <p class="note">
            {{ formatTurkishDate(r.requestedDate) }} → bugün arası. Getiriler AdjustedClose
            (temettü/bölünme düzeltilmiş) oranıdır; kripto ham fiyat değişimidir.
          </p>
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

    .tm-section { margin-bottom: 18px; }
    .tm-label {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .status {
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      padding: 24px 0;
    }
    .status.error { color: var(--down); }

    .sections {
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin-top: 8px;
    }

    .section {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
    }

    .section-head {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .section-icon { font-size: 16px; }

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
      gap: 8px;
      font-size: 12.5px;
    }

    .rank {
      flex: none;
      width: 16px;
      color: var(--muted);
      font-weight: 700;
      font-size: 11px;
    }

    .sym {
      flex: 1;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ret {
      flex: none;
      font-weight: 700;
      font-size: 11.5px;
    }
    .ret.up { color: var(--up); }
    .ret.down { color: var(--down); }

    .mult {
      flex: none;
      color: var(--muted);
      font-size: 10.5px;
      min-width: 40px;
      text-align: right;
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

  readonly formatTurkishDate = formatTurkishDate;
  readonly symbolColor = symbolColor;

  readonly dateStr = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly report = signal<TimeMachineDailyReport | null>(null);

  private lastRequestedFor = '';

  readonly sections = computed<MarketSection[]>(() => {
    const r = this.report();
    if (!r) return [];
    return [
      { key: 'bist', label: 'Borsa İstanbul', icon: '📈', gainers: r.bist.gainers, losers: r.bist.losers },
      { key: 'crypto', label: 'Kripto', icon: '₿', gainers: r.crypto.gainers, losers: r.crypto.losers },
      { key: 'us', label: 'ABD', icon: '🇺🇸', gainers: r.usStocks.gainers, losers: r.usStocks.losers },
    ];
  });

  constructor() {
    effect(() => {
      const open = this.modals.active() === 'dailyReport';
      if (!open) {
        this.lastRequestedFor = '';
        return;
      }
      if (!this.dateStr()) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        this.dateStr.set(d.toISOString().slice(0, 10));
      }
    });

    effect(() => {
      if (this.modals.active() !== 'dailyReport') return;
      const iso = this.dateStr();
      if (!iso || iso.length < 10 || iso === this.lastRequestedFor) return;
      this.lastRequestedFor = iso;
      this.fetch(iso);
    });
  }

  private fetch(iso: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getTimeMachineDailyReport(iso).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Hesaplanamadı. Backend bağlantısını kontrol et.');
        this.loading.set(false);
      },
    });
  }

  displaySymbol(market: Market, symbol: string): string {
    if (market !== 'crypto') return symbol;
    return symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
  }

  pctText(pct: number): string {
    const sign = pct >= 0 ? '+' : '';
    return Math.abs(pct) >= 1000 ? `${sign}%${formatInteger(pct)}` : `${sign}%${formatNumber(pct)}`;
  }

  multipleText(multiple: number): string {
    if (multiple >= 1000) return `${formatInteger(multiple)}×`;
    return `${multiple.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}×`;
  }

  onClose(): void {
    this.modals.close();
  }
}
