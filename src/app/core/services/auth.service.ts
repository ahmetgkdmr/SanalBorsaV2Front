import { Injectable, signal } from '@angular/core';
import { UserSession } from '../models/portfolio.model';

const SESSION_KEY = 'sb_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly user = signal<UserSession | null>(this.readSession());

  readonly currentUser = this.user.asReadonly();
  readonly isLoggedIn = () => !!this.user();

  login(username: string): UserSession {
    const trimmed = username.trim();
    const session: UserSession = {
      username: trimmed,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.user.set(session);
    return session;
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    this.user.set(null);
  }

  private readSession(): UserSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserSession;
    } catch {
      return null;
    }
  }
}
