import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { StockCardView } from '../../../../core/models/stock.model';
import { tierLabel } from '../../../../core/constants/bist-tiers';
import { formatNumber } from '../../../../core/utils/format.util';
import { PriceChangeComponent } from '../../../../shared/components/price-change/price-change.component';
import { SparklineComponent } from '../../../../shared/components/sparkline/sparkline.component';
import { StockLogoComponent } from '../../../../shared/components/stock-logo/stock-logo.component';

@Component({
  selector: 'app-stock-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StockLogoComponent, PriceChangeComponent, SparklineComponent],
  template: `
    <article class="card" (click)="selected.emit(stock().symbol)">
      <span class="badge">{{ tierLabel(stock().tier) }}</span>
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
      <app-sparkline [data]="stock().sparkline" [up]="stock().changePct >= 0" />
      <div class="vol mono">
        <span>Hacim</span>
        <span>{{ formatNumber(stock().volume) }} mn ₺</span>
      </div>
    </article>
  `,
  styles: `
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
      position: relative;
      overflow: hidden;
      transition: transform 0.15s, border-color 0.15s;
      cursor: pointer;

      &:hover {
        transform: translateY(-2px);
        border-color: #37456b;
      }
    }

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
      .cname {
        max-width: 90px;
      }
    }
  `,
})
export class StockCardComponent {
  readonly stock = input.required<StockCardView>();
  readonly selected = output<string>();

  readonly formatNumber = formatNumber;
  readonly tierLabel = tierLabel;
}
