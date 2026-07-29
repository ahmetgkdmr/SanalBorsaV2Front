import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { HeaderComponent } from '../header/header.component';
import { LoginModalComponent } from '../../features/auth/login-modal/login-modal.component';
import { CryptoDetailModalComponent } from '../../features/crypto-detail/crypto-detail-modal.component';
import { StockDetailModalComponent } from '../../features/stock-detail/stock-detail-modal.component';
import { TimeMachineModalComponent } from '../../features/time-machine/time-machine-modal.component';
import { AlertModalComponent } from '../../shared/components/alert-modal/alert-modal.component';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    LoginModalComponent,
    StockDetailModalComponent,
    CryptoDetailModalComponent,
    TimeMachineModalComponent,
    AlertModalComponent,
  ],
  template: `
    <app-header />
    <router-outlet />
    <app-footer />

    <app-login-modal />
    <app-stock-detail-modal />
    <app-crypto-detail-modal />
    <app-time-machine-modal />
    <app-alert-modal />
  `,
})
export class ShellComponent {}
