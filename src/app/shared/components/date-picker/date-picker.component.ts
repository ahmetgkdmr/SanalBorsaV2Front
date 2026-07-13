import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  model,
  signal,
  OnInit,
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
        <div class="dp-pop" (click)="$event.stopPropagation()">

          <!-- Ay/yıl header -->
          <div class="dph">
            <button type="button" class="dph-nav" (click)="prev()">‹</button>
            <div class="dph-title">
              <select [value]="vm()" (change)="setMonth(+$any($event.target).value)">
                @for (m of MONTHS; track $index) {
                  <option [value]="$index">{{ m }}</option>
                }
              </select>
              <select [value]="vy()" (change)="setYear(+$any($event.target).value)">
                @for (y of yearList(); track y) {
                  <option [value]="y">{{ y }}</option>
                }
              </select>
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
  styles: `
    :host { display: block; position: relative; }

    /* ── Hint ──────────────────────────────────────── */
    .dp-hint {
      font-size: 11.5px;
      color: var(--muted);
      margin-bottom: 8px;
      padding: 7px 11px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--line);
      border-radius: 10px;
      line-height: 1.5;
    }

    /* ── Tetikleyici ────────────────────────────────── */
    .dp-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--panel2);
      border: 1.5px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
      color: var(--text);
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: border-color 0.18s;

      &:hover { border-color: rgba(255,255,255,0.3); }
      &:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
    }

    .dp-icon { font-size: 16px; flex-shrink: 0; }
    .dp-val  { flex: 1; text-align: left; letter-spacing: 0.3px; }
    .dp-caret {
      font-size: 11px;
      color: var(--muted);
      transition: transform 0.18s;
      &.open { transform: rotate(180deg); }
    }

    /* ── Popover ────────────────────────────────────── */
    .dp-pop {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      width: 268px;
      max-width: 100%;
      z-index: 200;
      background: #1a1f2e;
      border: 1.5px solid var(--line);
      border-radius: 12px;
      padding: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      animation: dpIn 0.15s ease;
    }

    @keyframes dpIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: none; }
    }

    /* ── Header ─────────────────────────────────────── */
    .dph {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 6px;
    }

    .dph-title {
      flex: 1;
      display: flex;
      gap: 5px;
      justify-content: center;

      select {
        background: var(--panel);
        border: 1px solid var(--line);
        color: var(--text);
        font-weight: 700;
        font-size: 12.5px;
        padding: 4px 8px;
        border-radius: 7px;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        text-align: center;
        text-align-last: center;
        &:focus { outline: 1px solid var(--accent); }
      }
    }

    .dph-nav {
      background: var(--panel);
      border: 1px solid var(--line);
      color: var(--text);
      width: 24px;
      height: 24px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      flex-shrink: 0;
      &:hover { background: var(--line); }
    }

    /* ── Grid ───────────────────────────────────────── */
    .dpg {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
    }

    .dpg-dow {
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      color: var(--muted);
      padding: 2px 0 4px;
      letter-spacing: 0.2px;
    }

    .dpg-day {
      height: 28px;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 11px;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.1s;

      &:hover:not(:disabled):not(.sel) {
        background: rgba(255,255,255,0.1);
      }
      &.dim   { color: rgba(255,255,255,0.2); }
      &.today:not(.sel) {
        font-weight: 800;
        color: var(--accent);
      }
      &.sel {
        background: var(--accent);
        color: #1a1206;
        font-weight: 800;
      }
      &.off, &:disabled {
        color: rgba(255,255,255,0.15);
        cursor: not-allowed;
        text-decoration: line-through;
        opacity: 0.4;
      }
    }

    /* ── Footer kısayollar ──────────────────────────── */
    .dpf {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--line);
    }

    .dpf-btn {
      background: none;
      border: none;
      color: var(--accent);
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      padding: 3px 6px;
      border-radius: 6px;
      &:hover { background: rgba(255,255,255,0.06); }
    }
  `,
})
export class DatePickerComponent implements OnInit {
  readonly value  = model.required<string>();
  readonly minDate = input<string>('');
  readonly maxDate = input<string>(new Date().toISOString().slice(0, 10));
  readonly hint   = input<string>('');

  readonly DAYS   = TR_DAYS_SHORT;
  readonly MONTHS = TR_MONTHS;

  readonly open = signal(false);
  readonly vy   = signal(new Date().getFullYear());
  readonly vm   = signal(new Date().getMonth());

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

  constructor(private readonly _el: ElementRef) {}

  ngOnInit(): void {
    this._syncView();
  }

  toggle(): void { this.open.update(v => !v); }

  prev(): void {
    if (this.vm() === 0) { this.vm.set(11); this.vy.update(y => y - 1); }
    else this.vm.update(m => m - 1);
  }

  next(): void {
    if (this.vm() === 11) { this.vm.set(0); this.vy.update(y => y + 1); }
    else this.vm.update(m => m + 1);
  }

  setMonth(m: number): void { this.vm.set(m); }
  setYear(y: number):  void { this.vy.set(y); }

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

  private _syncView(): void {
    const v = this.value();
    if (!v) return;
    const d = new Date(v + 'T12:00:00');
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
