import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ModalService } from '../../../core/services/modal.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { OverlayComponent } from '../../../shared/components/overlay/overlay.component';

type AuthStep = 'choose' | 'form-login' | 'form-register' | 'profile';

@Component({
  selector: 'app-login-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, FormsModule, RouterLink],
  template: `
    <app-overlay [open]="modals.active() === 'login'" (closed)="onClose()">
      <div class="modal">
        <button class="m-close" type="button" (click)="onClose()">✕</button>

        @switch (step()) {
          @case ('choose') {
            <h2>Giriş Yap</h2>
            <p class="sub">
              Google veya kullanıcı adınla gir.
              Yeni hesapta <b style="color:var(--up)">1.000.000 ₺</b> sanal bakiye.
            </p>
            <div class="login-box">
              <label class="terms-row">
                <input type="checkbox" [(ngModel)]="acceptTerms" />
                <span>
                  <a routerLink="/kullanim-sartlari" target="_blank" rel="noopener" (click)="$event.stopPropagation()">Kullanım Şartları</a>
                  ve
                  <a routerLink="/gizlilik" target="_blank" rel="noopener" (click)="$event.stopPropagation()">Gizlilik / KVKK</a>
                  metinlerini okudum, sanal platform olduğunu ve yatırım tavsiyesi
                  olmadığını kabul ediyorum.
                </span>
              </label>

              <button
                class="btn-provider btn-google"
                type="button"
                (click)="onGoogle()"
                [disabled]="loading() || !acceptTerms"
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v8.51h12.8c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.14z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="#FBBC05" d="M10.53 28.58A13.94 13.94 0 0 1 9.5 24c0-1.59.27-3.12.75-4.58l-7.98-6.19A23.96 23.96 0 0 0 0 24c0 3.77.9 7.34 2.46 10.54l8.07-5.96z"/>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.46 13.23l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                </svg>
                Google ile Devam Et
              </button>

              <div class="divider"><span>veya</span></div>

              <button class="btn-provider btn-local" type="button" (click)="goFormLogin()" [disabled]="loading()">
                Kullanıcı adı ile giriş
              </button>
              <button class="btn-link" type="button" (click)="goFormRegister()" [disabled]="loading()">
                Hesap oluştur
              </button>

              @if (error()) {
                <div class="msg-error">{{ error() }}</div>
              }
            </div>
          }

          @case ('form-login') {
            <h2>Giriş Yap</h2>
            <p class="sub">Kullanıcı adı ve şifrenle devam et.</p>
            <div class="login-box">
              <label class="f-label">Kullanıcı adı</label>
              <div class="user-row">
                <span class="at">@</span>
                <input
                  class="f-input"
                  type="text"
                  maxlength="32"
                  [(ngModel)]="username"
                  (keyup.enter)="onPasswordLogin()"
                  placeholder="kullanici_adi"
                />
              </div>

              <label class="f-label">Şifre</label>
              <input
                class="f-input"
                type="password"
                [(ngModel)]="password"
                (keyup.enter)="onPasswordLogin()"
                placeholder="••••••••"
              />

              <button class="btn btn-main" type="button" (click)="onPasswordLogin()" [disabled]="loading()">
                @if (loading()) { Giriş yapılıyor… } @else { Giriş Yap }
              </button>
              <button class="btn-back" type="button" (click)="goBackToChoose()">← Geri</button>
              <button class="btn-link" type="button" (click)="goFormRegister()">Hesabın yok mu? Oluştur</button>

              @if (error()) {
                <div class="msg-error">{{ error() }}</div>
              }
            </div>
          }

          @case ('form-register') {
            <h2>Hesap Oluştur</h2>
            <p class="sub">Kullanıcı adı ve şifre yeterli. E-posta istemiyoruz.</p>
            <div class="login-box">
              <label class="f-label">Kullanıcı adı <span class="req">*</span></label>
              <div class="user-row">
                <span class="at">@</span>
                <input
                  class="f-input"
                  type="text"
                  maxlength="32"
                  [(ngModel)]="username"
                  (ngModelChange)="onUsernameChange($event)"
                  placeholder="ornek_kullanici"
                />
              </div>
              @if (usernameHint()) {
                <div class="hint" [class.ok]="usernameOk()" [class.bad]="!usernameOk()">
                  {{ usernameHint() }}
                </div>
              }

              <label class="f-label">Şifre <span class="req">*</span></label>
              <input
                class="f-input"
                type="password"
                [(ngModel)]="password"
                placeholder="En az 6 karakter"
              />

              <label class="f-label">Şifre tekrar <span class="req">*</span></label>
              <input
                class="f-input"
                type="password"
                [(ngModel)]="passwordConfirm"
                placeholder="Şifreyi tekrar yaz"
              />

              <label class="f-label">Görünen ad <span class="opt">opsiyonel</span></label>
              <input
                class="f-input"
                type="text"
                maxlength="100"
                [(ngModel)]="displayName"
                placeholder="İstersen bir isim"
              />

              <label class="terms-row">
                <input type="checkbox" [(ngModel)]="acceptTerms" />
                <span>
                  <a routerLink="/kullanim-sartlari" target="_blank" rel="noopener" (click)="$event.stopPropagation()">Kullanım Şartları</a>
                  ve
                  <a routerLink="/gizlilik" target="_blank" rel="noopener" (click)="$event.stopPropagation()">Gizlilik / KVKK</a>
                  metinlerini okudum ve kabul ediyorum. Platformun sanal olduğunu,
                  yatırım tavsiyesi içermediğini biliyorum.
                </span>
              </label>

              <button
                class="btn btn-main"
                type="button"
                (click)="onPasswordRegister()"
                [disabled]="loading() || !canSubmitRegister()"
              >
                @if (loading()) { Kaydediliyor… } @else { Kayıt Ol }
              </button>
              <button class="btn-back" type="button" (click)="goBackToChoose()">← Geri</button>
              <button class="btn-link" type="button" (click)="goFormLogin()">Zaten hesabın var? Giriş yap</button>

              @if (error()) {
                <div class="msg-error">{{ error() }}</div>
              }
            </div>
          }

          @case ('profile') {
            <h2>Hesabını oluştur</h2>
            <p class="sub">
              Kullanıcı adı zorunlu. Görünen adı sonra da değiştirebilirsin.
            </p>
            <div class="login-box">
              <label class="f-label">Kullanıcı adı <span class="req">*</span></label>
              <div class="user-row">
                <span class="at">@</span>
                <input
                  class="f-input"
                  type="text"
                  maxlength="32"
                  [(ngModel)]="username"
                  (ngModelChange)="onUsernameChange($event)"
                  placeholder="ornek_kullanici"
                />
              </div>
              @if (usernameHint()) {
                <div class="hint" [class.ok]="usernameOk()" [class.bad]="!usernameOk()">
                  {{ usernameHint() }}
                </div>
              }

              <label class="f-label">Görünen ad <span class="opt">opsiyonel</span></label>
              <input
                class="f-input"
                type="text"
                maxlength="100"
                [(ngModel)]="displayName"
                placeholder="Örn. Ahmet"
              />

              <label class="terms-row">
                <input type="checkbox" [(ngModel)]="acceptTerms" />
                <span>
                  <a routerLink="/kullanim-sartlari" target="_blank" rel="noopener" (click)="$event.stopPropagation()">Kullanım Şartları</a>
                  ve
                  <a routerLink="/gizlilik" target="_blank" rel="noopener" (click)="$event.stopPropagation()">Gizlilik / KVKK</a>
                  metinlerini okudum ve kabul ediyorum.
                </span>
              </label>

              <button
                class="btn btn-main"
                type="button"
                (click)="onCompleteProfile()"
                [disabled]="loading() || !canSubmitProfile()"
              >
                @if (loading()) { Kaydediliyor… } @else { Devam Et }
              </button>

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
    .btn-local  { background: var(--panel2); color: var(--text); }
    .btn-local:hover:not(:disabled) { background: var(--line); }

    .divider {
      display: flex; align-items: center; gap: 8px;
      color: var(--muted); font-size: 12px;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px; background: var(--line);
    }

    .btn-back, .btn-link {
      background: none; border: none; color: var(--muted);
      font-size: 13px; cursor: pointer; text-align: left; padding: 0;
    }
    .btn-link { text-align: center; color: var(--accent, var(--text)); font-weight: 600; }
    .btn-back:hover, .btn-link:hover { color: var(--text); }

    .msg-error { color: var(--down); font-size: 13px; font-weight: 600; }

    .f-label {
      font-size: 12px; font-weight: 700; color: var(--muted);
      display: flex; gap: 6px; align-items: baseline;
    }
    .req { color: var(--down); }
    .opt { font-weight: 500; opacity: 0.8; }
    .user-row {
      display: flex; align-items: center; gap: 8px;
    }
    .at {
      font-weight: 800; color: var(--muted); font-size: 16px;
    }
    .user-row .f-input { flex: 1; }
    .hint { font-size: 12px; font-weight: 600; }
    .hint.ok { color: var(--up); }
    .hint.bad { color: var(--down); }

    .terms-row {
      display: flex; gap: 10px; align-items: flex-start;
      font-size: 12px; line-height: 1.45; color: var(--muted);
      cursor: pointer;
      input { margin-top: 2px; width: 15px; height: 15px; flex: 0 0 auto; accent-color: var(--up); }
      a { color: var(--text); font-weight: 700; }
    }
  `,
})
export class LoginModalComponent {
  readonly modals = inject(ModalService);
  private readonly auth = inject(AuthService);
  private readonly portfolio = inject(PortfolioService);
  private readonly notifications = inject(NotificationService);

  readonly step = signal<AuthStep>('choose');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly usernameHint = signal('');
  readonly usernameOk = signal(false);

  username = '';
  password = '';
  passwordConfirm = '';
  displayName = '';
  acceptTerms = false;

  private pendingIdToken = '';
  private usernameCheckTimer?: ReturnType<typeof setTimeout>;

  onClose(): void {
    this.resetTransient();
    this.modals.close();
  }

  goBackToChoose(): void {
    this.error.set('');
    this.password = '';
    this.passwordConfirm = '';
    this.step.set('choose');
  }

  goFormLogin(): void {
    this.error.set('');
    this.password = '';
    this.passwordConfirm = '';
    this.step.set('form-login');
  }

  goFormRegister(): void {
    this.error.set('');
    this.password = '';
    this.passwordConfirm = '';
    this.usernameHint.set('');
    this.usernameOk.set(false);
    this.step.set('form-register');
    if (this.username.length >= 3) void this.checkUsername();
  }

  async onGoogle(): Promise<void> {
    if (!this.acceptTerms) {
      this.error.set('Devam etmek için Kullanım Şartları ve Gizlilik metnini kabul etmelisin.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      const outcome = await this.auth.loginWithGoogle();
      await this.handleOutcome(outcome);
    } catch (e: any) {
      this.error.set(this.friendlyAuthError(e, 'Google girişi başarısız.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onPasswordLogin(): Promise<void> {
    if (!this.username.trim() || !this.password) {
      this.error.set('Kullanıcı adı ve şifre gerekli.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.loginWithPassword(this.username.trim(), this.password);
      await this.portfolio.reload();
      void this.notifications.reload();
      this.resetTransient();
      this.modals.close();
    } catch (e: any) {
      this.error.set(this.friendlyAuthError(e, 'Giriş başarısız.'));
    } finally {
      this.loading.set(false);
    }
  }

  canSubmitRegister(): boolean {
    return (
      this.acceptTerms &&
      this.usernameOk() &&
      this.username.length >= 3 &&
      this.password.length >= 6 &&
      this.password === this.passwordConfirm
    );
  }

  async onPasswordRegister(): Promise<void> {
    if (!this.acceptTerms) {
      this.error.set('Kayıt için şartları kabul etmelisin.');
      return;
    }
    if (!this.canSubmitRegister()) {
      if (this.password !== this.passwordConfirm) {
        this.error.set('Şifreler eşleşmiyor.');
      } else if (this.password.length < 6) {
        this.error.set('Şifre en az 6 karakter olmalı.');
      }
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.registerWithPassword(
        this.username.trim(),
        this.password,
        this.passwordConfirm,
        this.displayName.trim() || null,
      );
      await this.portfolio.reload();
      void this.notifications.reload();
      this.resetTransient();
      this.modals.close();
    } catch (e: any) {
      this.error.set(this.friendlyAuthError(e, 'Kayıt tamamlanamadı.'));
    } finally {
      this.loading.set(false);
    }
  }

  onUsernameChange(value: string): void {
    this.username = value.trim();
    this.usernameOk.set(false);
    this.usernameHint.set('');
    if (this.usernameCheckTimer) clearTimeout(this.usernameCheckTimer);
    if (this.username.length < 3) {
      this.usernameHint.set('En az 3 karakter.');
      return;
    }
    this.usernameCheckTimer = setTimeout(() => void this.checkUsername(), 350);
  }

  canSubmitProfile(): boolean {
    return this.acceptTerms && this.usernameOk() && this.username.length >= 3;
  }

  async onCompleteProfile(): Promise<void> {
    if (!this.canSubmitProfile() || !this.pendingIdToken) return;
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.completeRegistration(
        this.pendingIdToken,
        this.username,
        this.displayName.trim() || null,
      );
      await this.portfolio.reload();
      void this.notifications.reload();
      this.resetTransient();
      this.modals.close();
    } catch (e: any) {
      this.error.set(this.friendlyAuthError(e, 'Kayıt tamamlanamadı.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async handleOutcome(
    outcome: Awaited<ReturnType<AuthService['loginWithGoogle']>>,
  ): Promise<void> {
    if (outcome.kind === 'session') {
      await this.portfolio.reload();
      void this.notifications.reload();
      this.resetTransient();
      this.modals.close();
      return;
    }

    this.pendingIdToken = outcome.idToken;
    this.username = outcome.hint.suggestedUsername || '';
    this.displayName = outcome.hint.suggestedDisplayName?.trim() || '';
    this.step.set('profile');
    if (this.username) await this.checkUsername();
  }

  private async checkUsername(): Promise<void> {
    try {
      const res = await this.auth.checkUsername(this.username);
      this.usernameOk.set(res.available);
      this.usernameHint.set(res.available ? 'Uygun.' : (res.reason || 'Alınmış.'));
    } catch {
      this.usernameOk.set(false);
      this.usernameHint.set('Kontrol edilemedi.');
    }
  }

  private resetTransient(): void {
    this.step.set('choose');
    this.error.set('');
    this.password = '';
    this.passwordConfirm = '';
    this.pendingIdToken = '';
    this.usernameHint.set('');
    this.usernameOk.set(false);
    this.acceptTerms = false;
  }

  private friendlyAuthError(e: any, fallback: string): string {
    const msg = (
      e?.error?.detail ??
      e?.error?.title ??
      e?.message ??
      fallback
    ) as string;

    if (msg.includes('firebase-service-account') || msg.includes('yapılandırılmamış')) {
      return msg;
    }
    return msg || fallback;
  }
}
