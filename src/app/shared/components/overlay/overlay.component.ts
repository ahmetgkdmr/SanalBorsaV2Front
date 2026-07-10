import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="overlay" (click)="onBackdrop($event)">
        <div class="modal-wrap" role="dialog">
          <ng-content />
        </div>
      </div>
    }
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(5, 8, 16, 0.72);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      z-index: 50;
      padding: 30px 16px;
      overflow-y: auto;
    }

    .modal-wrap {
      width: 100%;
      animation: tmIn 0.25s ease;
    }

    @keyframes tmIn {
      from {
        opacity: 0;
        transform: translateY(14px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class OverlayComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
