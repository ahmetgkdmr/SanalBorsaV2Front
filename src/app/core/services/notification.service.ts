import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationItem } from '../models/notification.model';
import { AuthService } from './auth.service';
import { NotificationApiService } from './notification-api.service';

const POLL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(NotificationApiService);

  private readonly _items = signal<NotificationItem[]>([]);
  private readonly _unreadCount = signal(0);

  readonly items = this._items.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();

  private pollTimer?: ReturnType<typeof setInterval>;

  constructor() {
    queueMicrotask(() => {
      if (this.auth.isLoggedIn()) void this.reload();
    });
  }

  async reload(): Promise<void> {
    if (!this.auth.isLoggedIn() || !this.auth.getAccessToken()) {
      this._items.set([]);
      this._unreadCount.set(0);
      return;
    }
    try {
      const r = await firstValueFrom(this.api.get());
      this._items.set(r.items);
      this._unreadCount.set(r.unreadCount);
    } catch {
      // sessizce yut — zil ikonu sadece mevcut durumu göstermeye devam eder
    }
  }

  /** Bildirim paneli açılınca çağrılır — hepsini okundu işaretler (proje sohbeti:
   * panel-açılınca-hepsi-okundu tercihi). Optimistic: API'yi beklemeden rozeti sıfırlar. */
  async markAllRead(): Promise<void> {
    if (this._unreadCount() === 0) return;
    this._items.set(this._items().map((n) => ({ ...n, isRead: true })));
    this._unreadCount.set(0);
    try {
      await firstValueFrom(this.api.markRead());
    } catch {
      // sunucu tarafı başarısız olsa bile UI okundu kalır; bir sonraki reload() düzeltir
    }
  }

  startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (this.auth.isLoggedIn()) void this.reload();
    }, POLL_MS);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
}
