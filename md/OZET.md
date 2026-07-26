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
