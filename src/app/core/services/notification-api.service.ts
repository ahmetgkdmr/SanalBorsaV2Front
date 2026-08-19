import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationItem, NotificationsState } from '../models/notification.model';

interface ApiNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface ApiNotificationsResult {
  items: ApiNotification[];
  unreadCount: number;
}

function mapItem(n: ApiNotification): NotificationItem {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt,
  };
}

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notifications`;

  get(): Observable<NotificationsState> {
    return this.http.get<ApiNotificationsResult>(this.base).pipe(
      map((r) => ({
        items: (r.items ?? []).map(mapItem),
        unreadCount: Number(r.unreadCount) || 0,
      })),
    );
  }

  markRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/mark-read`, {});
  }
}
