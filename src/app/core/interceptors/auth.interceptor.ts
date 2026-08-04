import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Bu yollarda 401 alınırsa refresh denenmez — sonsuz döngüye girmemek için. */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/password/login', '/auth/register', '/auth/password/register', '/auth/refresh'];

/**
 * Her outgoing HTTP isteğine Authorization: Bearer <token> başlığı ekler.
 * Token yoksa istek değişmeden devam eder (public endpoint'ler için).
 * 401 alınırsa access token'ı bir kez yenileyip isteği tekrar dener; yenileme de
 * başarısız olursa oturum kapanır (AuthService.ensureValidToken → logout).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AuthService);
  const token = auth.getAccessToken();

  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      const isUnauthorized = err instanceof HttpErrorResponse && err.status === 401;
      const skipRefresh = NO_REFRESH_PATHS.some((p) => req.url.includes(p));

      if (!isUnauthorized || !token || skipRefresh) {
        return throwError(() => err);
      }

      return from(auth.ensureValidToken()).pipe(
        switchMap((newToken) => {
          if (!newToken) return throwError(() => err);
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
        }),
      );
    }),
  );
};
