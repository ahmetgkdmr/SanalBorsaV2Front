import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatNumber } from '../../../core/utils/format.util';

@Component({
  selector: 'app-price-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chg mono" [class.up]="isUp()" [class.down]="!isUp()">
      {{ isUp() ? '▲' : '▼' }} %{{ absValue() }}
    </span>
  `,
  styles: `
    .chg {
      font-size: 13px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 8px;

      &.up {
        color: var(--up);
        background: var(--up-bg);
      }

      &.down {
        color: var(--down);
        background: var(--down-bg);
      }
    }
  `,
})
export class PriceChangeComponent {
  readonly value = input.required<number>();

  readonly isUp = computed(() => this.value() >= 0);
  readonly absValue = computed(() => formatNumber(Math.abs(this.value())));
}
