import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { symbolColor } from '../../../core/utils/format.util';
import { StockLogoComponent } from '../stock-logo/stock-logo.component';

export interface SymbolOption {
  value: string;
  title: string;
  subtitle?: string;
}

@Component({
  selector: 'app-symbol-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StockLogoComponent],
  template: `
    <div class="wrap" [class.open]="open()">
      <button class="trigger f-input" type="button" (click)="toggle($event)" [disabled]="disabled()">
        @if (selected(); as s) {
          <app-stock-logo [symbol]="s.value" [color]="colorOf(s.value)" [market]="market()" size="sm" />
          <span class="lab">
            <b>{{ s.title }}</b>
            @if (s.subtitle) {
              <span class="sub">{{ s.subtitle }}</span>
            }
          </span>
        } @else {
          <span class="placeholder">Sembol seç</span>
        }
        <span class="chev">▾</span>
      </button>

      @if (open()) {
        <div class="panel" (click)="$event.stopPropagation()">
          <input
            class="search"
            type="search"
            placeholder="Ara…"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
            autocomplete="off"
          />
          <ul class="list">
            @for (opt of filtered(); track opt.value) {
              <li
                [class.selected]="opt.value === value()"
                (mousedown)="pick(opt.value, $event)"
              >
                <app-stock-logo
                  [symbol]="opt.value"
                  [color]="colorOf(opt.value)"
                  [market]="market()"
                  size="sm"
                />
                <span class="lab">
                  <b>{{ opt.title }}</b>
                  @if (opt.subtitle) {
                    <span class="sub">{{ opt.subtitle }}</span>
                  }
                </span>
                @if (opt.value === value()) {
                  <span class="check">✓</span>
                }
              </li>
            } @empty {
              <li class="empty">Eşleşen yok</li>
            }
          </ul>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; flex: 2; }
    .wrap { position: relative; width: 100%; }
    .trigger {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: left;
      cursor: pointer;
      min-height: 44px;
      padding: 6px 12px;
    }
    .trigger:disabled { opacity: 0.55; cursor: not-allowed; }
    .placeholder { color: var(--muted); font-size: 13px; }
    .lab {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 1px;
      b { font-size: 13.5px; font-weight: 700; line-height: 1.2; }
    }
    .sub { font-size: 11px; color: var(--muted); font-weight: 600; }
    .chev { color: var(--muted); margin-left: auto; font-size: 12px; }
    .panel {
      position: absolute;
      z-index: 40;
      left: 0; right: 0; top: calc(100% + 6px);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.18);
      overflow: hidden;
    }
    .search {
      width: 100%;
      border: 0;
      border-bottom: 1px solid var(--line);
      background: var(--panel2);
      color: var(--text);
      padding: 11px 14px;
      font-size: 13px;
      outline: none;
    }
    .list {
      list-style: none; margin: 0; padding: 6px;
      max-height: 260px; overflow: auto;
    }
    .list li {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border-radius: 10px; cursor: pointer;
    }
    .list li:hover, .list li.selected {
      background: color-mix(in srgb, var(--accent, #22c98a) 14%, var(--panel2));
    }
    .check { color: var(--up); font-weight: 800; margin-left: auto; }
    .empty {
      justify-content: center; color: var(--muted); font-size: 13px;
      cursor: default !important;
    }
    .empty:hover { background: transparent !important; }
  `,
})
export class SymbolSelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly value = model<string>('');
  readonly options = input<SymbolOption[]>([]);
  readonly market = input<'bist' | 'crypto' | 'us'>('bist');
  readonly disabled = input(false);

  readonly open = signal(false);
  readonly query = signal('');

  readonly selected = computed(() => {
    const v = this.value();
    return this.options().find((o) => o.value === v) ?? null;
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toUpperCase();
    const opts = this.options();
    if (!q) return opts;
    return opts.filter(
      (o) =>
        o.value.toUpperCase().includes(q) ||
        o.title.toUpperCase().includes(q) ||
        (o.subtitle?.toUpperCase().includes(q) ?? false),
    );
  });

  colorOf(symbol: string): string {
    return symbolColor(symbol);
  }

  toggle(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.disabled()) return;
    this.open.update((v) => !v);
    if (!this.open()) this.query.set('');
  }

  pick(v: string, ev: MouseEvent): void {
    ev.preventDefault();
    this.value.set(v);
    this.open.set(false);
    this.query.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.open.set(false);
      this.query.set('');
    }
  }
}
