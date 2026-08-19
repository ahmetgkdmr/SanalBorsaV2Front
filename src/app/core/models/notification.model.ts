export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
}
