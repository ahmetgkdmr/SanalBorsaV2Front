import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  selector: 'app-alert-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (alerts.open()) {
      <div class="overlay" (click)="onBackdrop($event)">
        <div class="card" role="alertdialog" aria-modal="true">
          <h2>{{ alerts.title() }}</h2>
          <p class="body">{{ alerts.message() }}</p>
          <button class="btn btn-main" type="button" (click)="alerts.close()">Anladım</button>
        </div>
      </div>
    }
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(5, 8, 16, 0.78);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 80;
      padding: 20px 16px;
    }
    .card {
      width: min(440px, 100%);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 28px 24px 22px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
      animation: in 0.22s ease;
    }
    @keyframes in {
      from { opacity: 0; transform: translateY(10px) scale(0.98); }
      to { opacity: 1; transform: none; }
    }
    h2 {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 12px;
      letter-spacing: -0.02em;
    }
    .body {
      white-space: pre-line;
      font-size: 14px;
      line-height: 1.55;
      color: var(--muted);
      margin: 0 0 20px;
    }
    .btn-main {
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      border: none;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      background: var(--text);
      color: var(--panel);
    }
    .btn-main:hover { opacity: 0.92; }
  `,
})
export class AlertModalComponent {
  readonly alerts = inject(AlertService);

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.alerts.close();
  }
}
