import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="legal page">
      <a class="btn back-btn" routerLink="/">← Ana sayfa</a>
      <h1>Gizlilik ve KVKK Aydınlatma Metni</h1>
      <p class="meta">Son güncelleme: 30 Temmuz 2026 · SanalBorsa / Sanal Portföy</p>

      <div class="callout">
        6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında,
        veri sorumlusu sıfatıyla işlenen kişisel verilere ilişkin bilgilendirmedir.
      </div>

      <h2>1. Veri sorumlusu</h2>
      <p>
        SanalBorsa platformunu işleten kişi/kuruluş, KVKK anlamında veri sorumlusudur.
        İletişim: sitede belirtilen kanallar.
      </p>

      <h2>2. İşlenen veriler</h2>
      <ul>
        <li><b>Hesap:</b> kullanıcı adı, isteğe bağlı görünen ad, şifre özeti (hash), hesap tercihleri (ör. işlem geçmişi görünürlüğü).</li>
        <li><b>Google ile giriş:</b> Firebase/Google üzerinden gelen kimlik bilgileri (ör. e-posta, profil görseli, UID) — Google’ın paylaştığı ölçüde.</li>
        <li><b>Kullanım:</b> sanal portföy, işlem kayıtları, oturum/teknik loglar (IP, cihaz, hata kayıtları — güvenlik ve işletim için).</li>
        <li><b>İletişim:</b> bize yazarsanız mesaj içeriğiniz.</li>
      </ul>
      <p>
        Form ile kayıtta e-posta zorunlu tutulmuyorsa, yalnızca seçtiğiniz kullanıcı adı
        ve şifre bilgisi işlenir.
      </p>

      <h2>3. İşleme amaçları ve hukuki sebepler</h2>
      <ul>
        <li>Hizmetin sunulması, hesabın oluşturulması ve yönetilmesi (sözleşmenin kurulması/ifası).</li>
        <li>Güvenlik, kötüye kullanımın önlenmesi, hata ayıklama (meşru menfaat / yasal yükümlülük).</li>
        <li>Yasal zorunluluk halinde yetkili mercilere bilgi verilmesi.</li>
        <li>Açık rızanızın bulunduğu hallerde ek işlemeler.</li>
      </ul>

      <h2>4. Aktarım</h2>
      <p>
        Veriler; barındırma (ör. bulut sunucu), kimlik doğrulama (Firebase/Google) ve
        zorunlu teknik altyapı sağlayıcılarına, amaçla sınırlı olarak aktarılabilir.
        Yurt dışına aktarım söz konusuysa KVKK’daki uygun güvenceler gözetilir.
      </p>

      <h2>5. Saklama süresi</h2>
      <p>
        Veriler, hesabınız aktif olduğu sürece ve silme talebiniz / yasal saklama
        süreleri çerçevesinde tutulur. Hesap silme talebinde, yasal zorunluluklar
        saklı kalmak kaydıyla makul sürede silinir veya anonimleştirilir.
      </p>

      <h2>6. Güvenlik</h2>
      <p>
        Şifreler düz metin saklanmaz; teknik ve idari tedbirler uygulanır.
        İnternet üzerinden %100 güvenlik garanti edilemez.
      </p>

      <h2>7. Haklarınız (KVKK m.11)</h2>
      <p>Veri sorumlusuna başvurarak:</p>
      <ul>
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
        <li>İşlenmişse bilgi talep etme,</li>
        <li>Amaca uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li>Yurt içi/yurt dışı aktarılan üçüncü kişileri bilme,</li>
        <li>Eksik/yanlış işlenmişse düzeltilmesini isteme,</li>
        <li>KVKK’daki şartlarda silinmesini/yok edilmesini isteme,</li>
        <li>İşlemenin münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize çıkan sonuca itiraz etme,</li>
        <li>Kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme</li>
      </ul>
      <p>haklarına sahipsiniz.</p>

      <h2>8. Çerezler</h2>
      <p>
        Oturum ve tercih (ör. tema) için zorunlu/teknik çerezler veya yerel depolama
        kullanılabilir. Zorunlu olmayan çerezler için ayrıca bilgilendirme/onay
        mekanizması eklenmesi halinde bu metin güncellenir.
      </p>

      <h2>9. Değişiklikler</h2>
      <p>
        Bu aydınlatma metni güncellenebilir. Güncel sürüm sitede yayınlandığı tarihte
        geçerlidir.
      </p>

      <p class="note">
        Bu metin genel bir şablondur. Ticari unvan, açık adres, e-posta ve VERBİS
        kaydı gibi alanları kendi bilgilerinizle tamamlayıp bir avukata
        onaylatmanız önerilir.
      </p>

      <p><a routerLink="/kullanim-sartlari">← Kullanım Şartları</a></p>
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
      background: color-mix(in srgb, #3b82f6 10%, var(--panel2));
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
export class PrivacyPageComponent {}
