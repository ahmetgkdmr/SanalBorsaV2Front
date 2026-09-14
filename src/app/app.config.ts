import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Zoneless: değişiklik algılama zone.js'in monkey-patch'lerine değil signal'lara dayanıyor.
    // Uygulama zaten %100 OnPush + signal tabanlı olduğu için doğal adım; zone.js polyfill'i
    // kaldırıldığı için paket de küçülüyor.
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideRouter(routes),
  ],
};
