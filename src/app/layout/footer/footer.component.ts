import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <footer>
      <p class="disc">
        <b>Önemli uyarı:</b> SanalBorsa eğitim ve eğlence amaçlı bir sanal portföy platformudur.
        Gerçek para ile menkul kıymet alım-satımı yapılmaz. Gösterilen fiyatlar, sıralamalar ve
        simülasyon sonuçları bilgilendirme amaçlıdır; <b>yatırım tavsiyesi değildir</b>, getiri
        vaadi içermez. Gerçek piyasa kararlarınızdan doğan sonuçlardan platform sorumlu değildir.
      </p>
      <div class="links">
        <a routerLink="/kullanim-sartlari">Kullanım Şartları</a>
        <span aria-hidden="true">·</span>
        <a routerLink="/gizlilik">Gizlilik / KVKK</a>
      </div>
    </footer>
  `,
  styles: `
    footer {
      max-width: 1280px;
      margin: 0 auto 30px;
      padding: 0 24px;
      font-size: 11.5px;
      color: var(--muted);
      line-height: 1.55;
    }
    .disc { margin: 0 0 8px; max-width: 920px; }
    .links {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      a { color: var(--text); font-weight: 700; text-decoration: none; }
      a:hover { text-decoration: underline; }
    }
    @media (max-width: 600px) {
      footer { padding: 0 14px; }
    }
  `,
})
export class FooterComponent {}
