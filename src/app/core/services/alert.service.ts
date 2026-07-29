import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AlertService {
  readonly open = signal(false);
  readonly title = signal('');
  readonly message = signal('');

  show(title: string, message: string): void {
    this.title.set(title);
    this.message.set(message);
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }
}
