import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ModalService } from '../../../core/services/modal.service';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { OverlayComponent } from '../../../shared/components/overlay/overlay.component';

@Component({
  selector: 'app-login-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, FormsModule],
  template: `
    <app-overlay [open]="modals.active() === 'login'" (closed)="modals.close()">
      <div class="modal">
        <button class="m-close" type="button" (click)="modals.close()">✕</button>
        <h2>👤 Giriş Yap</h2>
        <p class="sub">
          Yeni kullanıcı adı girersen hesabın otomatik açılır ve
          <b style="color: var(--up)">1.000.000 ₺</b> sanal bakiye ile başlarsın.
        </p>
        <div class="login-box">
          <input class="f-input" type="text" placeholder="Kullanıcı adı" maxlength="20" [(ngModel)]="username" />
          <input class="f-input" type="password" placeholder="Şifre" [(ngModel)]="password" />
          <button class="btn btn-main" type="button" style="justify-content: center" (click)="submit()">
            Giriş / Kayıt Ol
          </button>
          <div class="login-note">
            Demo giriş: şifre kontrolü yapılmaz, veriler sadece bu tarayıcıda saklanır.
          </div>
          @if (message()) {
            <div class="trade-msg" [style.color]="message().includes('Hoş') ? 'var(--up)' : 'var(--down)'">
              {{ message() }}
            </div>
          }
        </div>
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
      padding: 26px;
      position: relative;
    }

    h2 {
      font-size: 21px;
      font-weight: 800;
    }

    .m-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--panel2);
      border: 1px solid var(--line);
      color: var(--muted);
      width: 34px;
      height: 34px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 16px;
    }

    .login-box {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 20px;
    }

    .login-note {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.5;
    }

    .trade-msg {
      font-size: 12.5px;
      font-weight: 600;
    }
  `,
})
export class LoginModalComponent {
  readonly modals = inject(ModalService);
  private readonly auth = inject(AuthService);
  private readonly portfolio = inject(PortfolioService);

  username = '';
  password = '';
  readonly message = signal('');

  submit(): void {
    if (!this.username.trim()) {
      this.message.set('Kullanıcı adı gerekli.');
      return;
    }
    this.auth.login(this.username);
    this.portfolio.reload();
    this.message.set(`Hoş geldin, ${this.username}!`);
    setTimeout(() => this.modals.close(), 600);
  }
}
