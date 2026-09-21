# Logo varlıkları

Hisse ve kripto logoları. Uygulama bunları `StockLogoComponent` üzerinden gösterir;
logo bulunamazsa sembolün ilk iki harfi renkli kutuda görünür.

## Klasörler

| Klasör | İçerik | Biçim | Kaynak |
|---|---|---|---|
| `bist/` | Borsa İstanbul | SVG | TradingView |
| `us/` | ABD hisseleri (S&P 500) | SVG | TradingView |
| `crypto/` | Kripto | PNG | CoinCap / cryptocurrency-icons / CoinGecko |

## Yenileme

```bash
# Backend ayakta olmalı — sembol listesi API'den okunur
node scripts/download-logos.mjs          # hepsi
node scripts/download-logos.mjs us       # sadece ABD
node scripts/download-logos.mjs bist     # sadece BIST
node scripts/download-logos.mjs crypto   # sadece kripto
```

Var olan dosyalar atlanır; yalnızca eksikler indirilir.

## `available.json`

Bileşenin okuduğu katalog: hangi sembol için hangi uzantının **diskte mevcut olduğu**.
İndirme betiği her çalıştığında **dosya sisteminden yeniden üretilir** — böylece katalog ile
gerçek dosyalar hiç ayrışmaz ve arayüz olmayan bir logoyu isteyip 404 almaz.

Elle düzenlenmemeli.

## ABD sembollerinde logo eşleştirme

TradingView'in `america` scanner'ı 10.000'den fazla kayıt döndürür; kendi evrenimizle
(~500 sembol) kesiştirilir. Üç aşamalı eşleştirme yapılır:

1. **Doğrudan ticker** — scanner'daki `logoid`.
2. **Nokta/tire varyantı** — TradingView çok sınıflı hisselerde nokta kullanır (`BRK.B`),
   bizim veritabanımızda tire var (`BRK-B`).
3. **İsimden slug** — scanner'da hiç dönmeyen (farklı borsada listelenen, ör. `CBOE`) ya da
   `logoid`'i boş gelen semboller için şirket adından slug üretilip doğrudan denenir.

Son çalıştırmada 503 sembolün tamamı eşleşti.
