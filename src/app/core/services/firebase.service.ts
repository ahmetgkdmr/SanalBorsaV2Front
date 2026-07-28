import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut,
} from 'firebase/auth';
import { environment } from '../../../environments/environment';

/**
 * Firebase Auth işlemlerini yönetir.
 * Uygulama hayatı boyunca tek örnek (providedIn: 'root').
 *
 * İleride farklı bir sağlayıcıya geçmek istersen bu service'i
 * başka bir implementasyonla değiştirmen yeterli; AuthService
 * kodunun geri kalanına dokunmana gerek yok.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private readonly app: FirebaseApp;
  private readonly auth: Auth;
  private confirmationResult: ConfirmationResult | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;

  constructor() {
    this.app  = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
  }

  /** Google hesabıyla popup açar, Firebase ID Token döner. */
  async signInWithGoogle(): Promise<string> {
    const provider = new GoogleAuthProvider();
    const result   = await signInWithPopup(this.auth, provider);
    return result.user.getIdToken();
  }

  /**
   * Telefon numarasına SMS doğrulama kodu gönderir.
   * @param phoneE164  '+905551234567' formatında
   * @param captchaContainerId  DOM element id'si (reCAPTCHA için)
   */
  async sendPhoneOtp(phoneE164: string, captchaContainerId: string): Promise<void> {
    this.clearRecaptcha(captchaContainerId);

    const container = document.getElementById(captchaContainerId);
    if (!container) {
      throw new Error('reCAPTCHA alanı bulunamadı. Sayfayı yenileyip tekrar dene.');
    }

    this.recaptchaVerifier = new RecaptchaVerifier(this.auth, captchaContainerId, {
      size: 'invisible',
      callback: () => { /* reCAPTCHA çözüldü */ },
      'expired-callback': () => {
        this.clearRecaptcha(captchaContainerId);
      },
    });

    try {
      this.confirmationResult = await signInWithPhoneNumber(
        this.auth,
        phoneE164,
        this.recaptchaVerifier,
      );
    } catch (err) {
      this.clearRecaptcha(captchaContainerId);
      throw err;
    }
  }

  /** Gönderilen SMS kodunu doğrular, Firebase ID Token döner. */
  async verifyPhoneOtp(code: string): Promise<string> {
    if (!this.confirmationResult)
      throw new Error('Önce telefon numarasına kod gönderilmeli.');
    const result = await this.confirmationResult.confirm(code);
    return result.user.getIdToken();
  }

  /** Önceki invisible reCAPTCHA widget'ını ve DOM içeriğini temizler. */
  clearRecaptcha(captchaContainerId = 'recaptcha-container'): void {
    try {
      this.recaptchaVerifier?.clear();
    } catch {
      // already cleared / detached
    }
    this.recaptchaVerifier = null;

    const el = document.getElementById(captchaContainerId);
    if (el) el.innerHTML = '';
  }

  /** Firebase oturumunu kapatır. */
  async signOut(): Promise<void> {
    await signOut(this.auth);
  }
}
