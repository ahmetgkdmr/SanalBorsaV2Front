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
      [class.crown]="!!stock().crownLabel"
      (click)="selected.emit(stock().symbol)"
    >
      @if (stock().crownLabel) {
        <span class="crown-tip" aria-hidden="true">♛</span>
      } @else if (stock().tierBadge) {
        <span class="badge">{{ stock().tierBadge }}</span>
      }

      <div class="card-top">
        <app-stock-logo [symbol]="stock().symbol" [color]="stock().color" />
        <div class="meta">
          <div class="tick">{{ stock().symbol }}</div>
          <div class="cname">{{ stock().name }}</div>
        </div>
      </div>

      @if (stock().crownLabel) {
        <div class="crown-ribbon" [attr.data-period]="stock().crownPeriod">
          <span class="crown-ribbon-text">{{ crownTitle() }}</span>
          @if (stock().crownReturnPct != null) {
            <span class="crown-ret">+{{ formatNumber(stock().crownReturnPct!) }}%</span>
          }
        </div>
      }

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
      height: 100%;
      box-sizing: border-box;
      transition: transform 0.15s, border-color 0.2s, box-shadow 0.2s;

      &:hover {
        transform: translateY(-2px);
      }
    }

    :host-context([data-theme='light']) .card {
      box-shadow: var(--shadow);
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
      z-index: 2;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--muted);
      border: 1px solid var(--line);
      padding: 3px 7px;
      border-radius: 100px;
      max-width: 42%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: none;
    }

    .crown-tip {
      position: absolute;
      top: 0;
      left: 3px;
      z-index: 3;
      font-size: 22px;
      line-height: 1;
      color: #ffd54a;
      text-shadow:
        0 0 6px rgba(255, 213, 74, 0.95),
        0 0 14px rgba(240, 192, 64, 0.7),
        0 1px 2px rgba(0, 0, 0, 0.55);
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
      pointer-events: none;
      animation: crown-pulse 2.2s ease-in-out infinite;
    }

    @keyframes crown-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.08); opacity: 0.92; }
    }

    .crown-ribbon {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: -2px 0 10px;
      padding: 5px 8px;
      border-radius: 8px;
      background: linear-gradient(90deg, #f0c040, #e8a317);
      color: #1a1206;
      box-shadow: 0 2px 8px rgba(240, 192, 64, 0.22);
    }

    .crown-ribbon[data-period='week'] {
      background: linear-gradient(90deg, #7dd3a0, #3cb371);
      color: #062012;
      box-shadow: 0 2px 8px rgba(60, 179, 113, 0.22);
    }

    .crown-ribbon[data-period='year'] {
      background: linear-gradient(90deg, #b388ff, #7c4dff);
      color: #140a22;
      box-shadow: 0 2px 8px rgba(124, 77, 255, 0.22);
    }

    .crown-ribbon-text {
      font-size: 9.5px;
      font-weight: 800;
      line-height: 1.2;
      min-width: 0;
    }

    .crown-ret {
      flex-shrink: 0;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      font-weight: 800;
    }

    .card.crown {
      border-color: rgba(240, 192, 64, 0.45);
    }

    .card-top {
      display: flex;
      align-items: center;
      gap: 11px;
      margin-bottom: 12px;
      min-width: 0;
    }

    .meta {
      min-width: 0;
      flex: 1;
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
      max-width: 100%;
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
  `,
})
export class StockCardComponent {
  readonly stock   = input.required<StockCardView>();
  readonly selected = output<string>();

  readonly isUp = computed(() => this.stock().changePct >= 0);

  readonly crownTitle = computed(() => {
    switch (this.stock().crownPeriod) {
      case 'week': return 'Son 1 haftanın en çok kazananı';
      case 'month': return 'Son 1 ayın en çok kazananı';
      case 'year': return 'Son 1 yılın en çok kazananı';
      default: return this.stock().crownLabel ?? '';
    }
  });

  readonly formatNumber = formatNumber;
}
