import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { StockCardView } from '../../../../core/models/stock.model';
import { formatNumber } from '../../../../core/utils/format.util';
import { PriceChangeComponent } from '../../../../shared/components/price-change/price-change.component';
import { SparklineComponent } from '../../../../shared/components/sparkline/sparkline.component';
import { StockLogoComponent } from '../../../../shared/components/stock-logo/stock-logo.component';

@Component({
  selector: 'app-stock-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StockLogoComponent, PriceChangeComponent, SparklineComponent],
  template: `
    <article
      class="card"
      [class.up]="isUp()"
      [class.down]="!isUp()"
      (click)="selected.emit(stock().symbol)"
    >
      @if (stock().tierBadge) {
        <span class="badge">{{ stock().tierBadge }}</span>
      }

      <div class="card-top">
        <app-stock-logo [symbol]="stock().symbol" [color]="stock().color" />
        <div>
          <div class="tick">{{ stock().symbol }}</div>
          <div class="cname">{{ stock().name }}</div>
        </div>
      </div>

      <div class="price-row">
        <div class="price mono">{{ formatNumber(stock().close) }} <small>₺</small></div>
        <app-price-change [value]="stock().changePct" />
      </div>

      <app-sparkline [data]="stock().sparkline" [up]="isUp()" />

      <div class="vol mono">
        <span>Hacim</span>
        <span>{{ formatNumber(stock().volume) }} mn ₺</span>
      </div>

      <!-- Köşe pulse noktası -->
      <span class="pulse-dot"></span>
    </article>
  `,
  styles: `
    /* ── temel kart ─────────────────────────────────────────────────────── */
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.15s, border-color 0.2s, box-shadow 0.2s;

      &:hover {
        transform: translateY(-2px);
      }
    }

    /* ── yeşil / kırmızı glow pulse ─────────────────────────────────────── */
    .card.up {
      border-color: rgba(34, 201, 138, 0.35);
      animation: glow-up 2.8s ease-in-out infinite;
    }

    .card.down {
      border-color: rgba(255, 82, 82, 0.35);
      animation: glow-down 2.8s ease-in-out infinite;
    }

    @keyframes glow-up {
      0%,  100% { box-shadow: 0 0 0px rgba(34, 201, 138, 0);    border-color: rgba(34, 201, 138, 0.25); }
      50%        { box-shadow: 0 0 12px rgba(34, 201, 138, 0.4); border-color: rgba(34, 201, 138, 0.65); }
    }

    @keyframes glow-down {
      0%,  100% { box-shadow: 0 0 0px rgba(255, 82, 82, 0);    border-color: rgba(255, 82, 82, 0.25); }
      50%        { box-shadow: 0 0 12px rgba(255, 82, 82, 0.4); border-color: rgba(255, 82, 82, 0.65); }
    }

    /* ── sol üst köşe pulse noktası ──────────────────────────────────────── */
    .pulse-dot {
      position: absolute;
      bottom: 10px;
      right: 12px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .card.up   .pulse-dot { background: var(--up);   animation: dot-pulse 2.8s ease-in-out infinite; }
    .card.down .pulse-dot { background: var(--down);  animation: dot-pulse 2.8s ease-in-out infinite; }

    @keyframes dot-pulse {
      0%,  100% { opacity: 0.3; transform: scale(0.8); }
      50%        { opacity: 1;   transform: scale(1.3); }
    }

    /* ── diğer elemanlar ─────────────────────────────────────────────────── */
    .badge {
      position: absolute;
      top: 14px;
      right: 14px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--muted);
      border: 1px solid var(--line);
      padding: 3px 7px;
      border-radius: 100px;
    }

    .card-top {
      display: flex;
      align-items: center;
      gap: 11px;
      margin-bottom: 12px;
    }

    .tick {
      font-weight: 800;
      font-size: 15px;
    }

    .cname {
      font-size: 11px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }

    .price-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 8px;
    }

    .price {
      font-size: 21px;
      font-weight: 600;

      small {
        font-size: 11px;
        color: var(--muted);
        font-weight: 400;
      }
    }

    .vol {
      margin-top: 8px;
      font-size: 11px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
    }

    @media (max-width: 600px) {
      .cname { max-width: 90px; }
    }
  `,
})
export class StockCardComponent {
  readonly stock   = input.required<StockCardView>();
  readonly selected = output<string>();

  readonly isUp = computed(() => this.stock().changePct >= 0);

  readonly formatNumber = formatNumber;
}
