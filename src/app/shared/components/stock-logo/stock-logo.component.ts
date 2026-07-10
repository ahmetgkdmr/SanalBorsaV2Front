import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stock-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="logo" [style.background]="color()">{{ initials() }}</div>
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
  `,
})
export class StockLogoComponent {
  readonly symbol = input.required<string>();
  readonly color = input.required<string>();

  initials(): string {
    return this.symbol().slice(0, 2);
  }
}
