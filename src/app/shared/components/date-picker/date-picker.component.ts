import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  model,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';

const TR_DAYS_SHORT = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const TR_MONTHS     = [
  'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık',
];

interface CalCell {
  date: Date;
  day: number;
  inMonth: boolean;
  disabled: boolean;
  today: boolean;
}

@Component({
  selector: 'app-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ── Tetikleyici input ──────────────────────────────── -->
    <div class="dp-root">
      @if (hint()) {
        <div class="dp-hint">📅 {{ hint() }}</div>
      }

      <button type="button" class="dp-trigger" (click)="toggle()">
        <span class="dp-icon">📆</span>
        <span class="dp-val">{{ displayValue() }}</span>
        <span class="dp-caret" [class.open]="open()">▾</span>
      </button>

      <!-- ── Popover takvim ─────────────────────────────────── -->
      @if (open()) {
        <div
          class="dp-pop"
          [class.up]="openUpward()"
          [style.top.px]="popTop()"
          [style.bottom.px]="popBottom()"
          [style.left.px]="popLeft()"
          (click)="$event.stopPropagation()"
        >

          <!-- Ay/yıl header -->
          <div class="dph">
            <button type="button" class="dph-nav" (click)="prev()">‹</button>
            <div class="dph-title">
              <span class="dph-select-wrap">
                <select (change)="onMonthSelect($event)">
                  @for (m of MONTHS; track $index) {
                    <option [value]="$index" [selected]="vm() === $index">{{ m }}</option>
                  }
                </select>
              </span>
              <span class="dph-select-wrap dph-select-wrap-year">
                <select (change)="onYearSelect($event)">
                  @for (y of yearList(); track y) {
                    <option [value]="y" [selected]="vy() === y">{{ y }}</option>
                  }
                </select>
              </span>
            </div>
            <button type="button" class="dph-nav" (click)="next()">›</button>
          </div>

          <!-- Gün başlıkları -->
          <div class="dpg">
            @for (d of DAYS; track d) {
              <span class="dpg-dow">{{ d }}</span>
            }

            <!-- Günler -->
            @for (c of cells(); track c.date.getTime()) {
              <button
                type="button"
                class="dpg-day"
                [class.dim]="!c.inMonth"
                [class.today]="c.today"
                [class.sel]="isSel(c.date)"
                [class.off]="c.disabled"
                [disabled]="c.disabled"
                (click)="pick(c)"
              >{{ c.day }}</button>
            }
          </div>

          <!-- Hızlı kısayollar -->
          <div class="dpf">
            <button type="button" class="dpf-btn" (click)="pickMin()">En Erken</button>
            <button type="button" class="dpf-btn" (click)="pickToday()">Bugün</button>
          </div>

        </div>
      }
    </div>
  `,
  styleUrl: './date-picker.component.css',
})
export class DatePickerComponent implements OnInit, OnDestroy {
  readonly value  = model.required<string>();
  readonly minDate = input<string>('');
  readonly maxDate = input<string>(new Date().toISOString().slice(0, 10));
  readonly hint   = input<string>('');

  readonly DAYS   = TR_DAYS_SHORT;
  readonly MONTHS = TR_MONTHS;

  readonly open = signal(false);
  readonly openUpward = signal(false);
  readonly popTop = signal<number | null>(null);
  readonly popBottom = signal<number | null>(null);
  readonly popLeft = signal<number>(0);
  readonly vy   = signal(new Date().getFullYear());
  readonly vm   = signal(new Date().getMonth());

  /** Native <select> DOM’a eklenirken sahte change ile ay/yılı sıfırlamasın. */
  private suppressSelect = false;

  private readonly _today = new Date();

  readonly displayValue = computed(() => {
    const v = this.value();
    if (!v) return 'Tarih seçin';
    const d = new Date(v + 'T12:00:00');
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  });

  readonly yearList = computed<number[]>(() => {
    const min = this.minDate() ? +this.minDate().slice(0, 4) : 2000;
    const max = this.maxDate() ? +this.maxDate().slice(0, 4) : new Date().getFullYear();
    const list: number[] = [];
    for (let y = max; y >= min; y--) list.push(y);
    return list;
  });

  readonly cells = computed<CalCell[]>(() => {
    const y = this.vy(), m = this.vm();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);

    let dow = first.getDay(); // 0=Sun
    dow = dow === 0 ? 6 : dow - 1; // 0=Mon

    const minD = this.minDate() ? new Date(this.minDate() + 'T00:00:00') : null;
    const maxD = this.maxDate() ? new Date(this.maxDate() + 'T00:00:00') : null;
    const todayISO = this._iso(this._today);

    const cells: CalCell[] = [];
    for (let i = dow - 1; i >= 0; i--)
      cells.push(this._cell(new Date(y, m, -i), false, minD, maxD, todayISO));
    for (let d = 1; d <= last.getDate(); d++)
      cells.push(this._cell(new Date(y, m, d), true, minD, maxD, todayISO));

    const needed = Math.ceil(cells.length / 7) * 7;
    let n = 1;
    while (cells.length < needed)
      cells.push(this._cell(new Date(y, m + 1, n++), false, minD, maxD, todayISO));

    return cells;
  });

  private readonly _reposition = () => this._updatePopPosition();

  constructor(private readonly _el: ElementRef) {
    // Parent değeri sonradan set edilince (ör. en eski tarih) görünümü güncelle.
    effect(() => {
      const v = this.value() || this.minDate();
      if (!v || this.open()) return;
      this._syncView();
    });

    // Popover açıkken sayfa/modal kaydırılırsa veya pencere yeniden boyutlanırsa konumu tazele
    // (fixed positioning artık local scroll'a bağlı değil, elle senkron tutulmalı).
    effect(() => {
      if (this.open()) {
        document.addEventListener('scroll', this._reposition, true);
        window.addEventListener('resize', this._reposition);
      } else {
        document.removeEventListener('scroll', this._reposition, true);
        window.removeEventListener('resize', this._reposition);
      }
    });
  }

  ngOnInit(): void {
    this._syncView();
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this._reposition, true);
    window.removeEventListener('resize', this._reposition);
  }

  toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this._syncView();
    this._updatePopPosition();
    this.suppressSelect = true;
    this.open.set(true);
    // Select mount + olası sahte change sonrası seçili aya geri kilitle.
    setTimeout(() => {
      this._syncView();
      this.suppressSelect = false;
    });
  }

  /**
   * Takvimi tetikleyiciye göre konumlar — position:fixed olduğu için viewport
   * koordinatları kullanılır (modal'ın overflow-y:auto'suyla kırpılmasın diye).
   * Altta sığmıyorsa ve üstte daha çok yer varsa yukarı açılır.
   */
  private _updatePopPosition(): void {
    const estimatedPopHeight = 360;
    const popWidth = 268;
    const rect = (this._el.nativeElement as HTMLElement).getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < estimatedPopHeight && spaceAbove > spaceBelow;
    this.openUpward.set(openUp);

    const maxLeft = window.innerWidth - popWidth - 8;
    this.popLeft.set(Math.round(Math.min(Math.max(rect.left, 8), Math.max(8, maxLeft))));

    if (openUp) {
      this.popBottom.set(Math.round(window.innerHeight - rect.top + 6));
      this.popTop.set(null);
    } else {
      this.popTop.set(Math.round(rect.bottom + 6));
      this.popBottom.set(null);
    }
  }

  prev(): void {
    if (this.vm() === 0) { this.vm.set(11); this.vy.update(y => y - 1); }
    else this.vm.update(m => m - 1);
  }

  next(): void {
    if (this.vm() === 11) { this.vm.set(0); this.vy.update(y => y + 1); }
    else this.vm.update(m => m + 1);
  }

  onMonthSelect(e: Event): void {
    if (this.suppressSelect) return;
    this.vm.set(+(e.target as HTMLSelectElement).value);
    this._applyViewAsValue();
  }

  onYearSelect(e: Event): void {
    if (this.suppressSelect) return;
    this.vy.set(+(e.target as HTMLSelectElement).value);
    this._applyViewAsValue();
  }

  /**
   * Ay/yıl dropdown'dan seçim, gün tıklamadan sadece görünümü değiştiriyordu —
   * kullanıcı takvimden çıkınca eski (farklı yıldaki) gün seçili kalıyordu. Artık
   * dropdown değişince önceki seçili gün yeni ay/yıla taşınıp otomatik seçili sayılır.
   */
  private _applyViewAsValue(): void {
    const y = this.vy(), m = this.vm();
    const curVal = this.value();
    const curDay = curVal ? new Date(curVal + 'T00:00:00').getDate() : this._today.getDate();
    const lastDay = new Date(y, m + 1, 0).getDate();
    let d = new Date(y, m, Math.min(curDay, lastDay));

    const minD = this.minDate() ? new Date(this.minDate() + 'T00:00:00') : null;
    const maxD = this.maxDate() ? new Date(this.maxDate() + 'T00:00:00') : null;
    if (minD && d < minD) d = minD;
    if (maxD && d > maxD) d = maxD;

    this.value.set(this._iso(d));
    this.vy.set(d.getFullYear());
    this.vm.set(d.getMonth());
  }

  pick(c: CalCell): void {
    if (c.disabled) return;
    this.value.set(this._iso(c.date));
    this.vy.set(c.date.getFullYear());
    this.vm.set(c.date.getMonth());
    this.open.set(false);
  }

  pickMin(): void {
    const min = this.minDate();
    if (min) { this.value.set(min); this._syncView(); this.open.set(false); }
  }

  pickToday(): void {
    const today = this._iso(this._today);
    const max   = this.maxDate();
    const min   = this.minDate();
    if ((!max || today <= max) && (!min || today >= min)) {
      this.value.set(today);
      this.vy.set(this._today.getFullYear());
      this.vm.set(this._today.getMonth());
      this.open.set(false);
    }
  }

  isSel(d: Date): boolean { return this._iso(d) === this.value(); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this._el.nativeElement.contains(e.target)) this.open.set(false);
  }

  /** Görünümü seçili tarihe (yoksa min) hizala. */
  private _syncView(): void {
    const v = this.value() || this.minDate();
    if (!v || v.length < 7) return;
    const d = new Date(v + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return;
    this.vy.set(d.getFullYear());
    this.vm.set(d.getMonth());
  }

  private _cell(
    date: Date, inMonth: boolean,
    min: Date | null, max: Date | null, todayISO: string,
  ): CalCell {
    return {
      date, day: date.getDate(), inMonth,
      disabled: (min != null && date < min) || (max != null && date > max),
      today: this._iso(date) === todayISO,
    };
  }

  private _iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
}
