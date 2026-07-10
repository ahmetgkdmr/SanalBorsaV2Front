import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer>
      Tüm fiyatlar ve karşılaştırmalar bilgilendirme amaçlıdır; yatırım tavsiyesi değildir.
      Sanal portföy ve liderlik tablosu tamamen oyundur.
    </footer>
  `,
  styles: `
    footer {
      max-width: 1280px;
      margin: 0 auto 30px;
      padding: 0 24px;
      font-size: 11px;
      color: var(--muted);
    }

    @media (max-width: 600px) {
      footer {
        padding: 0 14px;
      }
    }
  `,
})
export class FooterComponent {}
