import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ModalService } from '../../../core/services/modal.service';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { OverlayComponent } from '../../../shared/components/overlay/overlay.component';

type AuthStep = 'choose' | 'phone-enter' | 'phone-otp';

@Component({
  selector: 'app-login-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, FormsModule],
  template: `
    <app-overlay [open]="modals.active() === 'login'" (closed)="modals.close()">
      <div class="modal">
        <button class="m-close" type="button" (click)="modals.close()">✕</button>

        @switch (step()) {
          @case ('choose') {
            <h2>Giriş Yap</h2>
            <p class="sub">
              İlk girişte hesabın otomatik açılır,
              <b style="color:var(--up)">1.000.000 ₺</b> sanal bakiye ile başlarsın.
            </p>
            <div class="login-box">
              <button class="btn-provider btn-google" type="button" (click)="onGoogle()" [disabled]="loading()">
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v8.51h12.8c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.14z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="#FBBC05" d="M10.53 28.58A13.94 13.94 0 0 1 9.5 24c0-1.59.27-3.12.75-4.58l-7.98-6.19A23.96 23.96 0 0 0 0 24c0 3.77.9 7.34 2.46 10.54l8.07-5.96z"/>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.46 13.23l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                </svg>
                Google ile Devam Et
              </button>

              <div class="divider"><span>veya</span></div>

              <button class="btn-provider btn-phone" type="button" (click)="step.set('phone-enter')" [disabled]="loading()">
                <span>📱</span>
                Telefon ile Devam Et
              </button>

              @if (error()) {
                <div class="msg-error">{{ error() }}</div>
              }
            </div>
          }

          @case ('phone-enter') {
            <h2>Telefon Numarası</h2>
            <p class="sub">SMS doğrulama kodu göndereceğiz.</p>
            <div class="login-box">
              <div class="phone-row">
                <span class="phone-prefix">+90</span>
                <input
                  class="f-input phone-input"
                  type="tel"
                  placeholder="555 123 45 67"
                  maxlength="11"
                  [(ngModel)]="phoneLocal"
                />
              </div>
              <div id="recaptcha-container"></div>
              <button class="btn btn-main" type="button" (click)="onSendOtp()" [disabled]="loading()">
                @if (loading()) { Gönderiliyor… } @else { Kod Gönder }
              </button>
              <button class="btn-back" type="button" (click)="step.set('choose')">← Geri</button>
              @if (error()) {
                <div class="msg-error">{{ error() }}</div>
              }
            </div>
          }

          @case ('phone-otp') {
            <h2>Doğrulama Kodu</h2>
            <p class="sub">Telefonuna gelen 6 haneli kodu gir.</p>
            <div class="login-box">
              <input
                class="f-input otp-input"
                type="text"
                placeholder="_ _ _ _ _ _"
                maxlength="6"
                [(ngModel)]="otp"
                (keyup.enter)="onVerifyOtp()"
              />
              <button class="btn btn-main" type="button" (click)="onVerifyOtp()" [disabled]="loading()">
                @if (loading()) { Doğrulanıyor… } @else { Doğrula }
              </button>
              <button class="btn-back" type="button" (click)="step.set('phone-enter')">← Tekrar Gönder</button>
              @if (error()) {
                <div class="msg-error">{{ error() }}</div>
              }
            </div>
          }
        }
      </div>
    </app-overlay>
  `,
  styles: `
    .modal {
      max-width: 420px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 32px 28px 28px;
      position: relative;
    }

    h2 { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
    .sub { font-size: 13px; color: var(--muted); line-height: 1.5; margin-bottom: 4px; }

    .m-close {
      position: absolute; top: 16px; right: 16px;
      background: var(--panel2); border: 1px solid var(--line);
      color: var(--muted); width: 34px; height: 34px;
      border-radius: 10px; cursor: pointer; font-size: 16px;
    }

    .login-box { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }

    .btn-provider {
      display: flex; align-items: center; gap: 10px; justify-content: center;
      width: 100%; padding: 12px 16px; border-radius: 12px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      border: 1px solid var(--line); transition: background 0.15s;
    }
    .btn-provider:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-google { background: #fff; color: #1f1f1f; }
    .btn-google:hover:not(:disabled) { background: #f5f5f5; }
    .btn-phone  { background: var(--panel2); color: var(--text); }
    .btn-phone:hover:not(:disabled) { background: var(--line); }

    .divider {
      display: flex; align-items: center; gap: 8px;
      color: var(--muted); font-size: 12px;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px; background: var(--line);
    }

    .phone-row { display: flex; align-items: center; gap: 8px; }
    .phone-prefix {
      background: var(--panel2); border: 1px solid var(--line);
      border-radius: 10px; padding: 10px 12px;
      font-size: 14px; font-weight: 600; white-space: nowrap;
    }
    .phone-input { flex: 1; }

    .otp-input { letter-spacing: 10px; font-size: 22px; font-weight: 700; text-align: center; }

    .btn-back {
      background: none; border: none; color: var(--muted);
      font-size: 13px; cursor: pointer; text-align: left; padding: 0;
    }
    .btn-back:hover { color: var(--text); }

    .msg-error { color: var(--down); font-size: 13px; font-weight: 600; }
  `,
})
export class LoginModalComponent {
  readonly modals    = inject(ModalService);
  private readonly auth      = inject(AuthService);
  private readonly portfolio = inject(PortfolioService);

  readonly step    = signal<AuthStep>('choose');
  readonly loading = signal(false);
  readonly error   = signal('');

  phoneLocal = '';
  otp        = '';

  async onGoogle(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.loginWithGoogle();
      await this.portfolio.reload();
      this.modals.close();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Google girişi başarısız.');
    } finally {
      this.loading.set(false);
    }
  }

  async onSendOtp(): Promise<void> {
    const phone = '+90' + this.phoneLocal.replace(/\D/g, '');
    if (phone.length < 12) {
      this.error.set('Geçerli bir telefon numarası gir.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.sendPhoneOtp(phone, 'recaptcha-container');
      this.step.set('phone-otp');
    } catch (e: any) {
      this.error.set(e?.message ?? 'SMS gönderilemedi.');
    } finally {
      this.loading.set(false);
    }
  }

  async onVerifyOtp(): Promise<void> {
    if (this.otp.length !== 6) {
      this.error.set('6 haneli kodu gir.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.verifyPhoneOtp(this.otp);
      await this.portfolio.reload();
      this.modals.close();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Kod hatalı veya süresi dolmuş.');
    } finally {
      this.loading.set(false);
    }
  }
}
