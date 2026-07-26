import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stock-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="logo" [class.sm]="size() === 'sm'" [style.background]="color()">{{ initials() }}</div>
  `,
  styles: `
    .logo {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      color: #fff;
    }

    .logo.sm {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      font-size: 10px;
    }
  `,
})
export class StockLogoComponent {
  readonly symbol = input.required<string>();
  readonly color = input.required<string>();
  readonly size = input<'md' | 'sm'>('md');

  initials(): string {
    return this.symbol().slice(0, 2);
  }
}
