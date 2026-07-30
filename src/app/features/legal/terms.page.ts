import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="legal page">
      <a class="btn back-btn" routerLink="/">← Ana sayfa</a>
      <h1>Kullanım Şartları</h1>
      <p class="meta">Son güncelleme: 30 Temmuz 2026 · SanalBorsa / Sanal Portföy</p>

      <div class="callout">
        Bu platform <b>eğitim ve eğlence amaçlı sanal bir portföy uygulamasıdır</b>.
        Gerçek para ile menkul kıymet alım-satımı yapılmaz; aracı kurum, yatırım danışmanlığı
        veya portföy yönetim hizmeti sunulmaz.
      </div>

      <h2>1. Taraflar ve kabul</h2>
      <p>
        Siteyi kullanarak veya hesap oluşturarak bu Kullanım Şartları’nı ve
        <a routerLink="/gizlilik">Gizlilik / KVKK Aydınlatma Metni</a>’ni okuduğunuzu,
        anladığınızı ve kabul ettiğinizi beyan edersiniz. Kabul etmiyorsanız siteyi
        kullanmayınız.
      </p>

      <h2>2. Hizmetin niteliği</h2>
      <ul>
        <li>Gösterilen BIST ve kripto fiyatları bilgilendirme amaçlıdır; gecikmeli, eksik veya hatalı olabilir.</li>
        <li>Sanal bakiyeler (ör. 1.000.000 ₺ / 100.000 $) gerçek para değildir; çekilemez, nakde çevrilemez.</li>
        <li>Alım-satım, liderlik, zaman makinesi ve benzeri özellikler oyun / simülasyondur.</li>
        <li>Hiçbir içerik <b>yatırım tavsiyesi, alım-satım tavsiyesi veya getiri vaadi</b> değildir.</li>
      </ul>

      <h2>3. Yatırım ve finansal uyarı</h2>
      <p>
        Gerçek piyasalarda işlem yapmadan önce kendi araştırmanızı yapın ve gerekirse
        yetkili bir uzmana danışın. Platformda gördüğünüz performans, sıralama veya
        başka kullanıcıların işlemleri sizi yönlendirmek için tasarlanmamıştır; bunlara
        dayanarak verilen gerçek yatırım kararlarından doğan sonuçlardan platform
        sorumlu tutulamaz.
      </p>

      <h2>4. Hesap ve kullanıcı yükümlülükleri</h2>
      <ul>
        <li>Hesap güvenliğinizden (şifre, oturum) siz sorumlusunuz.</li>
        <li>Yasalara aykırı, hakaret, dolandırıcılık, spam veya yanıltıcı kullanım yasaktır.</li>
        <li>Sistemi kötüye kullanmak, otomasyon ile spam üretmek veya başka kullanıcıları yanıltmak yasaktır.</li>
        <li>Platform, ihlalde hesabı askıya alma veya silme hakkını saklı tutar.</li>
      </ul>

      <h2>5. Fikri mülkiyet</h2>
      <p>
        Site tasarımı, yazılımı ve marka unsurları ilgili hak sahiplerine aittir.
        İzinsiz kopyalama, tersine mühendislik veya ticari çoğaltma yasaktır.
        Piyasa verileri üçüncü taraf kaynaklardan gelebilir; ilgili sağlayıcıların
        koşulları saklıdır.
      </p>

      <h2>6. Sorumluluğun sınırlandırılması</h2>
      <p>
        Hizmet “olduğu gibi” sunulur. Kesintisiz, hatasız veya kesintisiz erişim
        garanti edilmez. Doğrudan veya dolaylı zararlar, kâr kaybı, veri kaybı veya
        üçüncü taraf iddialarından — yürürlükteki hukukun zorunlu kıldığı haller
        saklı kalmak kaydıyla — platform ve işletmecisi sorumlu tutulamaz.
      </p>

      <h2>7. Üçüncü taraf hizmetler</h2>
      <p>
        Giriş için Google / Firebase gibi üçüncü taraf kimlik hizmetleri
        kullanılabilir. Bu hizmetlerin kendi şartları ve gizlilik politikaları geçerlidir.
      </p>

      <h2>8. Değişiklikler</h2>
      <p>
        Bu metin zaman zaman güncellenebilir. Güncel sürüm sitede yayınlandığı anda
        geçerlilik kazanır. Önemli değişikliklerde makul ölçüde bilgilendirme
        yapılmaya çalışılır.
      </p>

      <h2>9. Uygulanacak hukuk</h2>
      <p>
        Bu şartlar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda yetkili
        mahkemeler, zorunlu hükümler saklı kalmak üzere, işletmecinin yerleşim yeri
        mahkemeleridir.
      </p>

      <h2>10. İletişim</h2>
      <p>
        Sorularınız için site üzerinden veya işletmecinin belirttiği iletişim
        kanallarından ulaşabilirsiniz.
      </p>

      <p class="note">
        Bu metin genel bilgilendirme amaçlı bir şablondur; bireysel hukuki danışmanlık
        yerine geçmez. İş modeliniz değişirse (ücretli sinyal, gerçek para vb.)
        metni bir avukata gözden geçirtmeniz önerilir.
      </p>
    </section>
  `,
  styles: `
    .legal {
      max-width: 760px;
      margin: 0 auto;
      padding: 24px 20px 60px;
    }
    h1 { font-size: 28px; font-weight: 800; margin: 18px 0 6px; letter-spacing: -0.02em; }
    h2 { font-size: 16px; font-weight: 800; margin: 22px 0 8px; }
    .meta { font-size: 12px; color: var(--muted); margin-bottom: 16px; }
    p, li { font-size: 14px; line-height: 1.65; color: var(--text); }
    ul { padding-left: 18px; margin: 8px 0; }
    li { margin-bottom: 6px; }
    a { color: inherit; font-weight: 700; }
    .callout {
      background: color-mix(in srgb, var(--accent, #f5b944) 12%, var(--panel2));
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 13.5px;
      line-height: 1.55;
      margin: 12px 0 8px;
    }
    .note {
      margin-top: 28px;
      font-size: 12px;
      color: var(--muted);
      border-top: 1px solid var(--line);
      padding-top: 14px;
    }
  `,
})
export class TermsPageComponent {}
