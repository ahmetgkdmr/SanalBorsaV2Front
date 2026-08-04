# SanalBorsa Frontend Özeti

> Yeni UI işi öncesi bu dosyayı oku. Kaynak: `sanal-borsa-ui/` (Angular, standalone components).

## Ne bu uygulama?

Sanal portföy / “keşke alsaydım” deneyimi:

- BIST ve kripto piyasasını gez
- Hisse / coin detay + grafik
- **Zaman makinesi**: geçmiş tarihten bugüne simülasyon (corp action dahil)
- Dönem şampiyonları (1h / 1a / 1y / 5y / 10y)
- Portföy + leaderboard
- Firebase auth + JWT

## Sayfalar / özellikler

| Yol | Bileşen | İş |
|-----|---------|-----|
| `/` | `features/market` | Piyasa listesi, filtre, şampiyon tacı |
| `/portfolio` | `features/portfolio` | Portföy |
| `/leaderboard` | `features/leaderboard` | Sıralama |
| (modal) | `features/stock-detail` | BIST detay |
| (modal) | `features/crypto-detail` | Kripto detay |
| (modal) | `features/time-machine` | Zaman makinesi + alternatif liderler |

Shell: `layout/shell` + header ticker + footer.

## Klasör yapısı

```
src/app/
  core/          # services, models, interceptors, constants
  features/      # sayfa / modal feature’ları
  layout/        # shell, header, footer, ticker
  shared/        # logo, sparkline, date-picker, overlay…
  md/            # bu özet
```

## Servisler (çekirdek)

| Servis | Görev |
|--------|--------|
| `StockApiService` | BIST API, time-machine, leaders, top-gainers |
| `CryptoApiService` / `CryptoMarketService` | Kripto liste + canlı |
| `MarketService` | BIST market state / cache |
| `PortfolioApiService` / `PortfolioService` | Portföy |
| `AuthService` + `FirebaseService` | Giriş |
| `IndexService` | Endeks şeridi |
| `ModalService` | Modal aç/kapa |
| `ThemeService` | Tema |

API base: `environment.apiUrl` (genelde `http://localhost:5042/api`).

## Auth akışı

`features/auth/login-modal` tek modal, 4 adım (`choose` / `form-login` / `form-register` / `profile`):

- **Google**: `FirebaseService.signInWithGoogle()` → idToken → `AuthService.loginWithGoogle()` → backend `NeedsProfile=true` dönerse kullanıcı adı seçme adımına (`profile`) geçer.
- **Kullanıcı adı + şifre**: `form-login` / `form-register` — backend'e e-posta gitmez, sadece username+password.
- Kullanıcı adı müsaitlik kontrolü debounce'lu (`350ms`) çağrılır (`AuthApiService.usernameAvailable`).
- Oturum `localStorage` (`sb_auth_session`) içinde `{ user, tokens: { accessToken, refreshToken, expiresAt } }` olarak saklanır (bkz. `core/models/auth.model.ts`).
- `authInterceptor` her giden isteğe (URL'e bakmaksızın) `Authorization: Bearer` ekliyor; `AuthApiService.refresh()` tanımlı ama **hiçbir yerden çağrılmıyor** — access token süresi dolunca (varsayılan 60 dk) otomatik yenileme/otomatik çıkış yok, kullanıcı sessizce 401 almaya başlar (bkz. eksikler).

## Portföy sayfası (`features/portfolio`)

- BIST al/sat + kripto al/sat; fiyat/derinlik backend'den, istemci fiyat göndermez.
- BIST kapalıyken (`bist-trading-hours.ts` — 18:45–10:00 TR dışı) `PortfolioService` işlemi göndermeden `BIST_CLOSED` popup'ı gösterir.
- Gizlilik ayarı (`privacyDraft` → `AuthService.updateTradeHistoryPrivacy`) burada — "işlem geçmişim herkese açık mı" toggle'ı gerçek backend alanına yazıyor.

## Zaman makinesi UI kuralları

- Tarih seç → API `GET /stocks/{symbol}/time-machine`
- Aynı gün alternatifleri: `GET /time-machine/leaders?date=`
- Pariteler (USD/EUR/altın) picker’da özel sembol olarak gelir
- Corp action hikâyesi backend’den `lotEvents` / `storyLines` ile gelir — UI sadece gösterir

## Tasarım / UX notları

- Mevcut dark trading UI dilini koru; yeni “AI landing” stiline kayma.
- Market = liste odaklı; hero/landing değil.
- Canlı kripto: SignalR / store — gereksiz polling ekleme.
- `stock-detail` içinde `effect` + market reload döngüsüne dikkat (geçmişte sonsuz `/api/stocks` bug’ı vardı).

## Backend’e bağımlılıklar

- Ham fiyat + corp action backend’de; UI adjusted seri uydurmaz.
- Top gainers / leaders gece job’larıyla dolan tablolardan okunur.
- Admin sync endpoint’leri UI’dan çağrılmaz (Swagger / Postman).

## Geliştirme checklist

1. Bu özeti oku
2. İlgili `core/services` + model’e bak
3. Backend `SanalBorsa/md/OZET.md` job/veri kaynağına bak
4. Modal ise `ModalService` akışına uy

## Bilinen eksikler / TODO (2026-08-02 taraması)

> Güncel/canlı liste (backend + frontend birlikte, durum işaretli): backend reposunda `md/RISKLER.md`.

- **`/leaderboard` sayfası tamamen mock** (`core/constants/leaderboard.mock.ts` — sahte kullanıcı adları, sahte işlemler, `Math.random` yerine deterministik üretim). Backend’de bunu besleyecek bir endpoint yok. Kullanıcılar gerçek insanların verisi sanabilir — ya net şekilde "örnek veri" etiketlenmeli ya da backend’e gerçek bir leaderboard sorgusu eklenip buraya bağlanmalı.
- `authInterceptor` (`core/interceptors/auth.interceptor.ts`) token’ı **hedef URL’e bakmadan** her isteğe ekliyor; şu an sadece backend’e istek atılıyor ama ileride üçüncü parti bir API çağrılırsa access token o adrese de sızar. `req.url.startsWith(environment.apiUrl)` kontrolü eklenmesi önerilir.
- Access token süresi dolduğunda otomatik yenileme yok (`AuthApiService.refresh` çağrılmıyor) — kullanıcı 60 dk sonra arka planda sessizce yetkisiz kalır, sayfayı yenilemeden fark etmeyebilir. 401 interceptor + refresh-and-retry veya en azından "oturumun bitti, tekrar giriş yap" uyarısı eklenmeli.
- Token’lar `localStorage`’da düz JSON — XSS olursa access+refresh token birlikte çalınabilir (backend tarafında refresh token zaten revoke edilemiyor, bkz. backend OZET). Kısa vadede büyük bir mimari değişiklik gerekmez ama bilinmesi gereken bir trade-off.
