import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: `:host { display: block; min-height: 100vh; }`,
})
export class App {
  /** Eager-init: tema localStorage’dan uygulanır */
  private readonly _theme = inject(ThemeService);
}
