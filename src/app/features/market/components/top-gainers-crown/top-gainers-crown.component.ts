import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { StockApiService, TopGainerItem } from '../../../../core/services/stock-api.service';
import { ModalService } from '../../../../core/services/modal.service';
import { formatNumber, symbolColor } from '../../../../core/utils/format.util';
import { StockLogoComponent } from '../../../../shared/components/stock-logo/stock-logo.component';

@Component({
  selector: 'app-top-gainers-crown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StockLogoComponent],
  template: `
    @if (items().length) {
      <section class="crown-section">
        <div class="crown-head">
          <span class="crown-emoji" aria-hidden="true">👑</span>
          <div>
            <h3>Dönem Şampiyonları</h3>
            @if (asOf()) {
              <p class="sub">Son kapanış: {{ formatDate(asOf()!) }} · her gece 23:05 güncellenir</p>
            }
          </div>
        </div>

        <div class="crown-grid">
          @for (item of items(); track item.period) {
            <button
              type="button"
              class="crown-card"
              [attr.data-period]="item.period"
              (click)="open(item.symbol)"
            >
              <div class="ribbon">
                <span class="crown-mini">♛</span>
                <span>{{ item.periodLabel }}</span>
              </div>

              <div class="body">
                <app-stock-logo [symbol]="item.symbol" [color]="color(item.symbol)" />
                <div class="meta">
                  <div class="tick">{{ item.symbol }}</div>
                  <div class="name">{{ item.name }}</div>
                </div>
                <div class="ret mono">+{{ formatNumber(item.returnPct) }}%</div>
              </div>

              <div class="foot mono">
                <span>{{ formatNumber(item.startPrice) }} ₺</span>
                <span class="arrow">→</span>
                <span>{{ formatNumber(item.endPrice) }} ₺</span>
              </div>
            </button>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .crown-section {
      margin: 18px 0 8px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid var(--crown-border);
      background: var(--crown-bg);
      box-shadow: var(--shadow);
    }

    .crown-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .crown-emoji {
      font-size: 28px;
      filter: drop-shadow(0 2px 8px rgba(240, 192, 64, 0.55));
    }

    h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.2px;
      color: var(--crown-title);
    }

    .sub {
      margin: 3px 0 0;
      font-size: 11.5px;
      color: var(--muted);
    }

    .crown-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    @media (max-width: 860px) {
      .crown-grid { grid-template-columns: 1fr; }
    }

    .crown-card {
      text-align: left;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 0;
      overflow: hidden;
      cursor: pointer;
      background: var(--panel);
      color: var(--text);
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        transform: translateY(-3px);
        border-color: rgba(240, 192, 64, 0.55);
        box-shadow: 0 10px 24px rgba(240, 192, 64, 0.18);
      }

      &[data-period='week'] .ribbon { background: linear-gradient(90deg, #7dd3a0, #3cb371); color: #062012; }
      &[data-period='month'] .ribbon { background: linear-gradient(90deg, #f0c040, #e8a317); color: #1a1206; }
      &[data-period='year'] .ribbon { background: linear-gradient(90deg, #b388ff, #7c4dff); color: #140a22; }
    }

    .ribbon {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.2px;
    }

    .crown-mini { font-size: 14px; }

    .body {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
    }

    .meta { flex: 1; min-width: 0; }
    .tick { font-weight: 800; font-size: 15px; }
    .name {
      font-size: 11px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ret {
      font-size: 16px;
      font-weight: 800;
      color: var(--up);
      white-space: nowrap;
    }

    .foot {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 0 12px 12px;
      font-size: 11px;
      color: var(--muted);
    }

    .arrow { opacity: 0.6; }
  `,
})
export class TopGainersCrownComponent implements OnInit {
  private readonly api = inject(StockApiService);
  private readonly modals = inject(ModalService);

  readonly items = signal<TopGainerItem[]>([]);
  readonly asOf = signal<string | null>(null);
  readonly formatNumber = formatNumber;

  ngOnInit(): void {
    this.api.getTopGainers().subscribe({
      next: (res) => {
        this.items.set(res.items ?? []);
        this.asOf.set(res.asOfDate);
      },
      error: () => {
        this.items.set([]);
      },
    });
  }

  color(symbol: string): string {
    return symbolColor(symbol);
  }

  open(symbol: string): void {
    this.modals.openStock(symbol);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
