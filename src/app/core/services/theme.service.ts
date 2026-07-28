import { Injectable, effect, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'sanalborsa.theme';

function readStored(): AppTheme {
  // Şimdilik yalnızca açık mod
  return 'light';
  /*
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light') return 'light';
    // 'modern' veya bilinmeyen → koyu
  } catch {
    // ignore
  }
  return 'dark';
  */
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<AppTheme>(readStored());

  constructor() {
    effect(() => {
      const t = this.theme();
      this.apply(t);
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch {
        /* ignore */
      }
    });
  }

  setTheme(_theme: AppTheme): void {
    // Şimdilik koyu moda geçiş kapalı
    this.theme.set('light');
    // this.theme.set(theme);
  }

  private apply(_theme: AppTheme): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    // root.setAttribute('data-theme', theme);
    // root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  }
}
