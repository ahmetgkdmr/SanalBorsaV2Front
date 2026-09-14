import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Bu yollarda 401 alınırsa refresh denenmez — sonsuz döngüye girmemek için.
 *
 * `/auth/logout` özellikle önemli: refresh başarısız olduğunda AuthService.logout() çağrılıyor,
 * o da sunucuya istek atıyor. O istek de 401 alıp refresh tetikleseydi, hâlâ devam etmekte olan
 * refresh promise'ini beklerdi — ve o promise de logout'un bitmesini beklediği için karşılıklı
 * kilitlenme oluşurdu.
 */
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/password/login',
  '/auth/register',
  '/auth/password/register',
  '/auth/refresh',
  '/auth/logout',
];

/**
 * İstek kendi backend'imize mi gidiyor? Göreli yollar (proxy üzerinden `/api/...`) da
 * bize aittir; mutlak adreslerde environment.apiUrl öneki aranır.
 */
function isApiRequest(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return true;
  return url.startsWith(environment.apiUrl) || url.startsWith(environment.hubUrl);
}

/**
 * Her outgoing HTTP isteğine Authorization: Bearer <token> başlığı ekler.
 * Token yoksa istek değişmeden devam eder (public endpoint'ler için).
 * 401 alınırsa access token'ı bir kez yenileyip isteği tekrar dener; yenileme de
 * başarısız olursa oturum kapanır (AuthService.ensureValidToken → logout).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AuthService);
  // Token SADECE kendi API'mize gider. Önceden hedefe bakılmadan ekleniyordu; bugün tek
  // muhatap backend olduğu için sorun çıkmıyordu ama ileride üçüncü parti bir servise
  // istek atıldığında erişim token'ı o adrese de sızardı.
  const token = isApiRequest(req.url) ? auth.getAccessToken() : null;

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
