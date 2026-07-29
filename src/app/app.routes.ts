import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/market/market.page').then((m) => m.MarketPageComponent),
      },
      {
        path: 'portfolio',
        loadComponent: () =>
          import('./features/portfolio/portfolio.page').then((m) => m.PortfolioPageComponent),
      },
      {
        path: 'leaderboard',
        loadComponent: () =>
          import('./features/leaderboard/leaderboard.page').then((m) => m.LeaderboardPageComponent),
      },
      {
        path: 'kullanim-sartlari',
        loadComponent: () =>
          import('./features/legal/terms.page').then((m) => m.TermsPageComponent),
      },
      {
        path: 'gizlilik',
        loadComponent: () =>
          import('./features/legal/privacy.page').then((m) => m.PrivacyPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
