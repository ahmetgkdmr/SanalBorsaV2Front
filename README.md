# SanalBorsa UI

BIST sanal borsa uygulamasının Angular ön yüzü. `index.html` prototipinin component tabanlı karşılığıdır.

## Gereksinimler

- Node.js 22+
- .NET API (`http://localhost:5042`)

## Çalıştırma

```bash
# API (ayrı terminal)
cd ../SanalBorsa/SanalBorsa
dotnet run

# Angular
npm install
npm start
```

Uygulama: http://localhost:4200  
API istekleri `proxy.conf.json` ile backend'e yönlendirilir.

## Mimari

```
src/app/
├── core/           # Modeller, servisler, sabitler, yardımcılar
├── shared/         # Tekrar kullanılan UI bileşenleri
├── layout/         # Header, footer, shell
└── features/       # Sayfa ve modal bileşenleri
    ├── market/
    ├── portfolio/
    ├── leaderboard/
    ├── time-machine/
    ├── stock-detail/
    └── auth/
```

- **Standalone components** + **signals**
- Lazy-loaded route'lar
- Portföy ve giriş: `localStorage` (demo)
- Piyasa verisi: gerçek API (`/api/stocks`, fiyat geçmişi)

## Not

Angular 22 için Node.js `v22.22.3+` gerekir. Mevcut ortamda proje **Angular 21** ile oluşturulmuştur.
