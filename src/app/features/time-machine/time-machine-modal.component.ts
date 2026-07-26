import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getMinimumWage } from '../../core/constants/app.constants';
import {
  TimeMachineCalc,
  TimeMachineLeader,
  TimeMachineLeaders,
  TimeMachineMode,
} from '../../core/models/time-machine.model';
import { MarketService } from '../../core/services/market.service';
import { StockApiService } from '../../core/services/stock-api.service';
import { IndexService } from '../../core/services/index.service';
import { ModalService } from '../../core/services/modal.service';
import { CryptoApiService } from '../../core/services/crypto-api.service';
import { CryptoMarketService } from '../../core/services/crypto-market.service';
import {
  formatInteger,
  formatMoneyAmount,
  formatNumber,
  formatTurkishDate,
  formatLotRange,
  symbolColor,
} from '../../core/utils/format.util';
import {
  PARITY_ICONS,
  PARITY_LABELS,
  PARITY_SYMBOLS,
  ParitySymbol,
  isForexSymbol,
  isIndexSymbol,
} from '../../core/models/index.model';
import { OverlayComponent } from '../../shared/components/overlay/overlay.component';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';
import { TimeMachineSimulationComponent } from './time-machine-simulation.component';

type InvestMode = 'wage' | 'custom';

type PickerOption = {
  value: string;
  title: string;
  subtitle?: string;
  badge: string;
  color: string;
};

@Component({
  selector: 'app-time-machine-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayComponent, FormsModule, TimeMachineSimulationComponent, DatePickerComponent],
  template: `
    <app-overlay [open]="modals.active() === 'timeMachine'" (closed)="onClose()">
      <div class="modal">
        <button class="m-close" type="button" (click)="onClose()">✕</button>
        <h2>🕰️ Zaman Makinesi <span class="prem-tag">PREMIUM · şimdilik herkese açık</span></h2>
        <p class="sub">{{ subtitle() }}</p>

        <!-- ── Sembol seçimi ───────────────────────────────── -->
        <div class="tm-section">
          <div class="tm-label">{{ instrumentLabel() }}</div>
          <div class="stock-pick">
            <div class="pick-logo" [style.background]="logoColor()">{{ symbolBadge() }}</div>
            <div class="sym-combo" [class.open]="pickerOpen()">
              <button
                type="button"
                class="sym-trigger f-input"
                (click)="togglePicker()"
                [attr.aria-expanded]="pickerOpen()"
              >
                <span class="sym-trigger-label">{{ selectedLabel() }}</span>
                <span class="sym-chevron" aria-hidden="true">▾</span>
              </button>

              @if (pickerOpen()) {
                <div class="sym-panel" role="listbox">
                  <input
                    class="sym-search"
                    type="search"
                    [placeholder]="isCryptoTm() ? 'Coin ara (BTC, ETH…)' : 'Hisse ara (THYAO…)'"
                    [ngModel]="pickerQuery()"
                    (ngModelChange)="onPickerQuery($event)"
                    (keydown.arrowDown)="onPickerNav($event, 1)"
                    (keydown.arrowUp)="onPickerNav($event, -1)"
                    (keydown.enter)="onPickerEnter($event)"
                    (keydown.escape)="closePicker()"
                    autocomplete="off"
                    spellcheck="false"
                    #pickerSearch
                  />
                  <ul class="sym-list">
                    @for (opt of pickerOptions(); track opt.value; let i = $index) {
                      <li
                        role="option"
                        [class.active]="i === pickerIndex()"
                        [class.selected]="opt.value === symbol()"
                        (mousedown)="pickSymbol(opt.value)"
                      >
                        <span class="opt-logo" [style.background]="opt.color">{{ opt.badge }}</span>
                        <span class="opt-main">
                          <b>{{ opt.title }}</b>
                          @if (opt.subtitle) {
                            <span class="opt-sub">{{ opt.subtitle }}</span>
                          }
                        </span>
                        @if (opt.value === symbol()) {
                          <span class="opt-check">✓</span>
                        }
                      </li>
                    } @empty {
                      <li class="sym-empty">Eşleşen kayıt yok</li>
                    }
                  </ul>
                </div>
              }
            </div>
          </div>
          @if (!isCryptoTm()) {
            <p class="idx-note">
              BIST endekslerinde Zaman Makinesi yok — endeks bileşimi değişir; temettü / bedelli / bedelsiz
              hisse bazında yansıtılamaz.
            </p>
          }
        </div>

        <!-- ── Tarih seçici ───────────────────────────────── -->
        <div class="tm-section">
          <div class="tm-label">TARİH SEÇ</div>
          <app-date-picker
            [value]="dateStr()"
            (valueChange)="onDateChange($event)"
            [minDate]="minDateStr()"
            [maxDate]="todayStr"
            [hint]="calendarHint()"
          />
        </div>

        <!-- ── Alım şekli ─────────────────────────────────── -->
        <div class="tm-section">
          <div class="tm-label">ALIM ŞEKLİ</div>
          <div class="seg">
            <button type="button" [class.active]="mode() === 'lump'" (click)="setMode('lump')">
              💰 Tek Seferlik
            </button>
            <button type="button" [class.active]="mode() === 'dca'" (click)="setMode('dca')">
              📅 Her Ay Düzenli
            </button>
          </div>
        </div>

        <!-- ── Yatırım tutarı ─────────────────────────────── -->
        <div class="tm-section">
          <div class="tm-label">YATIRIM TUTARI</div>
          <div class="seg invest-mode-seg">
            <button type="button" [class.active]="investMode() === 'wage'" (click)="setInvestMode('wage')">
              🏦 Asgari Ücret Bazlı
            </button>
            <button type="button" [class.active]="investMode() === 'custom'" (click)="setInvestMode('custom')">
              ✏️ Özel Tutar
            </button>
          </div>

          @if (investMode() === 'wage') {
            <div class="wage-block">
              <div class="pct-row">
                <span class="tm-label" style="margin:0">ASGARİ ÜCRETİN YÜZDE KAÇI?</span>
                <b class="pct-val mono">%{{ pct() }}</b>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                [ngModel]="pct()"
                (ngModelChange)="onPctChange($event)"
                [style.--fill]="((pct() - 5) / 95 * 100) + '%'"
              />
              <div class="wage-info" [innerHTML]="wageInfo()"></div>
            </div>
          } @else {
            <div class="custom-block">
              <div class="custom-input-wrap">
                <input
                  type="number"
                  class="f-input custom-amount-input"
                  [ngModel]="customAmount() > 0 ? customAmount() : null"
                  (ngModelChange)="onCustomAmountChange($event)"
                  placeholder="Tutar girin ({{ isCryptoTm() ? '$' : '₺' }})"
                  min="1"
                  step="100"
                />
                <span class="currency-badge">{{ isCryptoTm() ? '$' : '₺' }}</span>
              </div>
              <div class="wage-info">
                {{ mode() === 'dca' ? 'Her ay' : 'Tek seferinde' }}
                <b>{{ formatInteger(customAmount()) }} {{ isCryptoTm() ? '$' : '₺' }}</b> yatırılacak.
              </div>
            </div>
          }
        </div>

        <!-- ── Aksiyon butonları ──────────────────────────── -->
        <div class="tm-actions">
          <button class="btn btn-main" type="button" (click)="calculate()" [disabled]="loading() || !canCalculate()">
            {{ loading() ? 'Hesaplanıyor…' : 'Hesapla' }}
          </button>
          <button class="btn btn-prem" type="button" [disabled]="!canSimulate()" (click)="runSim()">
            ✨ Simüle Et
          </button>
        </div>

        <!-- ── Sonuç ──────────────────────────────────────── -->
        @if (calc(); as r) {
          @if (r.error) {
            <div class="result show">
              <p class="headline err">{{ r.error }}</p>
            </div>
          } @else {
            <div class="result show">
              <p class="headline">
                <span class="big">{{ formatInteger(r.currentValue) }} ₺</span> bugünkü değer —
                <span [class.neg]="r.gainPct < 0">
                  {{ r.gainPct >= 0 ? '+' : '' }}%{{ formatNumber(r.gainPct) }}
                </span>
              </p>

              @if (r.storyLines.length) {
                <div class="story">
                  @for (line of r.storyLines; track $index) {
                    <p class="story-line">{{ line }}</p>
                  }
                </div>
              }

              <div class="stat-grid">
                <div class="stat">
                  <div class="k">YATIRILAN</div>
                  <div class="v mono">{{ formatInteger(r.invested) }} ₺</div>
                </div>
                <div class="stat">
                  <div class="k">ALIM FİYATI</div>
                  <div class="v mono">{{ formatNumber(r.buyPrice) }} ₺</div>
                </div>
                <div class="stat">
                  <div class="k">{{ lotLabel() }}</div>
                  <div class="v mono" [class.lot-growth]="r.initialLots !== r.lots">
                    {{ formatLotRange(r.initialLots, r.lots) }}
                  </div>
                  @if (r.initialLots !== r.lots && !isInstrumentMode()) {
                    <div class="k sub">başlangıç → bugün</div>
                  }
                </div>
                <div class="stat">
                  <div class="k">BUGÜN</div>
                  <div class="v mono">{{ formatNumber(r.currentPrice) }} ₺</div>
                </div>
                @if (!isInstrumentMode() && r.dividendsReceived > 0) {
                  <div class="stat">
                    <div class="k">TEMETTÜ</div>
                    <div class="v mono">{{ formatInteger(r.dividendsReceived) }} ₺</div>
                    <div class="k sub">toplam gelir</div>
                  </div>
                  <div class="stat">
                    <div class="k">GERİ YATIRILAN</div>
                    <div class="v mono accent">{{ formatInteger(r.dividendsReinvested) }} ₺</div>
                    @if (r.lotsFromReinvestment > 0) {
                      <div class="k sub">+{{ formatInteger(r.lotsFromReinvestment) }} lot</div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        }

        <!-- ── Aynı gün X TL ile ne alsaydın? ─────────────────── -->
        @if (leaders()) {
          <div class="alt-panel">
            <div class="alt-head">
              <span class="alt-title">🔀 {{ altPanelTitle() }}</span>
              <span class="alt-when">{{ altWhen() }}</span>
            </div>

            @if (mode() === 'dca') {
              <p class="alt-dca-note">
                Düzenli aylık alım seçili; aşağıdaki karşılaştırmalar tek seferlik alımla
                {{ formatMoneyAmount(altInvestAmount()) }} {{ isCryptoTm() ? '$' : '₺' }}
                yatırılmış gibi hesaplanmıştır (her ay tekrar eden alım değil).
              </p>
            }

            <div class="parity-row">
              @for (p of parityChips(); track p.symbol) {
                <div class="parity-chip" [class.miss]="!p.leader">
                  <div class="chip-top">
                    <span class="chip-ico">{{ parityIcon(p.symbol) }}</span>
                    <b class="chip-name">{{ parityLabel(p.symbol) }}</b>
                    @if (p.leader; as row) {
                      <span class="chip-ret" [class.neg]="row.returnPct < 0">
                        {{ pctText(row.returnPct) }}
                      </span>
                    }
                  </div>
                  @if (p.leader; as row) {
                    <span class="chip-sub mono">
                      {{ formatNumber(row.startPrice) }} → {{ formatNumber(row.endPrice) }} ₺
                    </span>
                    <span class="chip-grown mono" [class.neg]="row.returnPct < 0">
                      <span class="grown-from">{{ formatMoneyAmount(altInvestAmount()) }} ₺</span>
                      <span class="grown-arrow">→</span>
                      <span class="grown-to">~{{ formatMoneyAmount(grownFromReturn(row.returnPct)) }} ₺</span>
                    </span>
                  } @else {
                    <span class="chip-sub">Bu tarihte veri yok</span>
                  }
                </div>
              }
            </div>

            <div class="seg alt-seg">
              <button type="button" [class.active]="altTab() === 'bist'" (click)="setAltTab('bist')">
                📈 Borsa İstanbul
              </button>
              <button type="button" [class.active]="altTab() === 'crypto'" (click)="setAltTab('crypto')">
                ₿ Kripto
              </button>
            </div>

            @if (altList().length) {
              <ol class="alt-list">
                @for (l of altList(); track l.symbol) {
                  <li class="alt-item" [attr.data-rank]="l.rank">
                    <span class="alt-rank">{{ l.rank }}</span>
                    <span class="alt-logo" [style.background]="symbolColor(l.symbol)">
                      {{ altBadge(l.symbol) }}
                    </span>
                    <span class="alt-main">
                      <b>{{ altTitle(l) }}</b>
                      <span class="alt-sub mono">
                        {{ formatNumber(l.startPrice) }} → {{ formatNumber(l.endPrice) }}
                      </span>
                      <span class="alt-grown mono" [class.neg]="l.returnPct < 0">
                        <span class="grown-from">{{ formatMoneyAmount(altInvestAmount()) }} {{ altCurrency() }}</span>
                        <span class="grown-arrow">→</span>
                        <span class="grown-to">~{{ formatMoneyAmount(grownFromReturn(l.returnPct)) }} {{ altCurrency() }}</span>
                      </span>
                    </span>
                    <span class="alt-figures">
                      <span class="alt-ret" [class.neg]="l.returnPct < 0">{{ pctText(l.returnPct) }}</span>
                      <span class="alt-mult mono">{{ multipleText(returnMultiple(l.returnPct)) }}</span>
                    </span>
                  </li>
                }
              </ol>
            } @else {
              <p class="alt-empty">{{ altEmptyText() }}</p>
            }

            <p class="alt-note">{{ altNote() }}</p>
          </div>
        }

        @if (showSim() && calc() && !calc()!.error) {
          <app-time-machine-simulation [calc]="calc()!" [runTrigger]="simTrigger()" />
        }
      </div>
    </app-overlay>
  `,
  styles: `
    .modal {
      max-width: 760px;
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
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
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
    }

    .tm-section {
      margin-top: 20px;
    }

    .tm-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: var(--muted);
      margin-bottom: 9px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;

      b { color: var(--text); font-size: 13px; }
    }

    .stock-pick {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .sym-combo {
      position: relative;
      flex: 1;
      min-width: 0;
    }

    .sym-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      text-align: left;
      cursor: pointer;
      width: 100%;

      &:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
    }

    .sym-combo.open .sym-trigger {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
    }

    .sym-trigger-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
    }

    .sym-chevron {
      color: var(--muted);
      font-size: 12px;
      flex: 0 0 auto;
      transition: transform 0.15s ease;
    }

    .sym-combo.open .sym-chevron { transform: rotate(180deg); }

    .sym-panel {
      position: absolute;
      z-index: 40;
      left: 0;
      right: 0;
      top: calc(100% + 6px);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
    }

    .sym-search {
      width: 100%;
      border: none;
      border-bottom: 1px solid var(--line);
      background: var(--panel2);
      color: var(--text);
      font-size: 13.5px;
      font-weight: 600;
      padding: 12px 14px;
      outline: none;
    }

    .sym-list {
      list-style: none;
      margin: 0;
      padding: 6px;
      max-height: 260px;
      overflow: auto;
    }

    .sym-list li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 10px;
      border-radius: 10px;
      cursor: pointer;
      color: var(--text);

      &:hover,
      &.active {
        background: color-mix(in srgb, var(--accent) 16%, var(--panel2));
      }

      &.selected {
        background: color-mix(in srgb, var(--accent) 22%, transparent);
      }
    }

    .opt-logo {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      flex: 0 0 auto;
    }

    .opt-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;

      b {
        font-size: 13.5px;
        font-weight: 700;
      }
    }

    .opt-sub {
      font-size: 11.5px;
      color: var(--muted);
      font-weight: 600;
    }

    .opt-check {
      color: var(--accent);
      font-weight: 800;
      font-size: 14px;
    }

    .sym-empty {
      justify-content: center;
      color: var(--muted);
      font-size: 13px;
      cursor: default !important;
      &:hover { background: transparent !important; }
    }

    .idx-note {
      margin: 8px 0 0;
      font-size: 11.5px;
      line-height: 1.45;
      color: var(--muted);
    }

    .pick-logo {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: #fff;
      font-size: 14px;
      flex: 0 0 auto;
    }

    /* Tarih seçici host genişliği */
    app-date-picker { display: block; }

    /* ── Segment butonlar ─────────────────────────────────── */
    .seg {
      display: flex;
      gap: 6px;
      background: var(--panel2);
      border: 1px solid var(--line);
      padding: 5px;
      border-radius: 12px;
      width: fit-content;
      max-width: 100%;
      flex-wrap: wrap;

      button {
        border: none;
        background: transparent;
        color: var(--muted);
        font-weight: 700;
        font-size: 12.5px;
        padding: 9px 14px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: 0.18s;

        &:hover { color: var(--text); }
        &.active { background: var(--accent); color: #1a1206; }
      }
    }

    .invest-mode-seg { margin-bottom: 14px; }

    /* ── Wage block ──────────────────────────────────────── */
    .wage-block { margin-top: 2px; }

    .pct-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .pct-val {
      font-size: 20px;
      font-weight: 700;
      color: var(--text);
    }

    input[type='range'] {
      width: 100%;
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      border-radius: 6px;
      background: linear-gradient(90deg, var(--accent) var(--fill, 50%), var(--line) var(--fill, 50%));
      outline: none;
      cursor: pointer;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--accent);
        cursor: pointer;
        border: 2px solid var(--bg);
      }
    }

    /* ── Custom amount block ─────────────────────────────── */
    .custom-block { margin-top: 2px; }

    .custom-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .custom-amount-input {
      width: 100%;
      font-size: 22px;
      font-weight: 700;
      padding: 14px 52px 14px 18px;
      border-radius: 14px;
      letter-spacing: 0.5px;

      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button { -webkit-appearance: none; }
    }

    .currency-badge {
      position: absolute;
      right: 16px;
      font-size: 18px;
      font-weight: 700;
      color: var(--muted);
      pointer-events: none;
    }

    /* ── Wage info ────────────────────────────────────────── */
    .wage-info {
      margin-top: 9px;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.6;

      b { color: var(--text); }
    }

    /* ── Actions ─────────────────────────────────────────── */
    .tm-actions {
      display: flex;
      gap: 10px;
      margin-top: 24px;
      flex-wrap: wrap;
    }

    .btn-main, .btn-prem {
      flex: 1;
      justify-content: center;
      min-width: 140px;
    }

    .btn-prem:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    /* ── Sonuç ───────────────────────────────────────────── */
    .result {
      margin-top: 24px;
      border-top: 1px dashed var(--line);
      padding-top: 22px;

      &.show { animation: tmIn 0.3s; }
    }

    .headline {
      font-size: 15px;
      line-height: 1.65;

      &.err { color: var(--down); font-size: 13px; }

      .big { font-size: 26px; font-weight: 800; color: var(--up); }
      .neg { color: var(--down); }
    }

    .story {
      margin: 14px 0 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .story-line {
      margin: 0;
      padding: 10px 12px;
      border-left: 3px solid var(--accent);
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      border-radius: 0 10px 10px 0;
      font-size: 13px;
      line-height: 1.55;
      color: var(--text);
    }

    .stat .v.accent { color: var(--accent); }

    .lot-growth { color: var(--prem); }

    .stat .k.sub {
      margin-top: 4px;
      font-size: 9px;
      opacity: 0.75;
    }

    @keyframes tmIn {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: none; }
    }

    /* ── "Aynı gün başka ne alsaydın?" paneli ─────────────── */
    .alt-panel {
      margin-top: 18px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel2);
      animation: tmIn 0.35s ease both;
    }

    .alt-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .alt-title { font-size: 14px; font-weight: 800; }

    .alt-when { font-size: 11px; opacity: 0.7; }

    .parity-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }

    .parity-chip {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 10px 11px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--panel);
      min-width: 0;
    }

    .chip-top {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .chip-ico { font-size: 15px; flex: none; }

    .chip-name {
      font-size: 12px;
      font-weight: 800;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chip-sub {
      font-size: 10px;
      opacity: 0.65;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chip-ret {
      font-size: 11px;
      font-weight: 800;
      color: var(--up);
      white-space: nowrap;
      flex: none;
      margin-left: auto;
    }

    .chip-ret.neg, .alt-ret.neg { color: var(--down); }

    .chip-grown, .alt-grown {
      display: flex;
      align-items: baseline;
      flex-wrap: nowrap;
      gap: 4px;
      margin-top: 2px;
      line-height: 1.2;
      white-space: nowrap;
      min-width: 0;
    }

    .grown-from {
      font-size: 10px;
      font-weight: 600;
      opacity: 0.55;
      flex: none;
    }

    .grown-arrow {
      font-size: 11px;
      opacity: 0.45;
      flex: none;
    }

    .grown-to {
      font-size: 13px;
      font-weight: 800;
      color: var(--up);
      letter-spacing: -0.02em;
      white-space: nowrap;
    }

    .chip-grown .grown-to { font-size: 12.5px; }

    .chip-grown.neg .grown-to,
    .alt-grown.neg .grown-to {
      color: var(--down);
    }

    .parity-chip.miss {
      opacity: 0.55;
    }

    .alt-dca-note {
      margin: 0 0 12px;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px dashed var(--line);
      background: color-mix(in srgb, var(--panel) 80%, transparent);
      font-size: 11px;
      line-height: 1.45;
      opacity: 0.85;
    }

    .alt-seg { margin-bottom: 12px; }

    .alt-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .alt-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--panel);
    }

    .alt-item[data-rank='1'] {
      border-color: var(--crown-border, #e8a317);
      background: var(--crown-bg, var(--panel));
    }

    .alt-rank {
      width: 20px;
      text-align: center;
      font-size: 11px;
      font-weight: 800;
      opacity: 0.6;
      flex: none;
    }

    .alt-item[data-rank='1'] .alt-rank { opacity: 1; color: #e8a317; }

    .alt-logo {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      flex: none;
    }

    .alt-main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .alt-main b { font-size: 13px; }

    .alt-sub { font-size: 10px; opacity: 0.6; }

    .alt-figures {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex: none;
    }

    .alt-ret { font-size: 13px; font-weight: 800; color: var(--up); }

    .alt-mult { font-size: 10px; opacity: 0.65; }

    .alt-empty, .alt-note {
      margin: 10px 0 0;
      font-size: 10.5px;
      line-height: 1.5;
      opacity: 0.62;
    }

    @media (max-width: 560px) {
      .parity-row { grid-template-columns: 1fr; }
    }
  `,
})
export class TimeMachineModalComponent {
  readonly modals = inject(ModalService);
  private readonly market = inject(MarketService);
  private readonly stockApi = inject(StockApiService);
  private readonly indexService = inject(IndexService);
  private readonly cryptoApi = inject(CryptoApiService);
  private readonly cryptoMarket = inject(CryptoMarketService);

  readonly formatNumber = formatNumber;
  readonly formatInteger = formatInteger;
  readonly formatMoneyAmount = formatMoneyAmount;
  readonly formatLotRange = formatLotRange;
  readonly symbolColor = symbolColor;
  readonly isInstrumentMode = computed(
    () => isIndexSymbol(this.symbol()) || isForexSymbol(this.symbol()),
  );

  readonly symbol    = signal('THYAO');
  readonly mode      = signal<TimeMachineMode>('lump');
  readonly pct       = signal(50);
  readonly investMode = signal<InvestMode>('wage');
  /** 0 = boş özel tutar (placeholder) */
  readonly customAmount = signal(0);
  readonly loading   = signal(false);
  readonly calc      = signal<TimeMachineCalc | null>(null);
  readonly showSim   = signal(false);
  readonly simTrigger = signal(0);

  /** Modal bu oturumda açık mı — her yeni açılışta formu sıfırlamak için */
  private tmWasOpen = false;

  // ── Seçili tarih — veri gelince earliest'e snap edilir
  dateStr = signal('');
  readonly todayStr = new Date().toISOString().slice(0, 10);

  // ── Erken tarih sınırı ───────────────────────────────
  private readonly cryptoEarliest = signal<string | null>(null);
  /** Liste API'sinde earliest yoksa detaydan doldurulur */
  private readonly bistEarliestOverride = signal<string | null>(null);

  readonly isCryptoTm = computed(() => this.modals.timeMachineMarket() === 'crypto');

  readonly minDateStr = computed<string>(() => {
    const sym = this.symbol();
    if (this.isCryptoTm()) {
      return (this.cryptoEarliest() ?? '').slice(0, 10);
    }
    if (isIndexSymbol(sym) || isForexSymbol(sym)) {
      const q = this.indexService.quotes().find((q) => q.symbol === sym);
      if (q?.earliestDate) return q.earliestDate.slice(0, 10);
      return '';
    }
    const fromLive = this.market.getEarliestDate(sym);
    if (fromLive) return fromLive.slice(0, 10);
    const override = this.bistEarliestOverride();
    return override ? override.slice(0, 10) : '';
  });

  /** Takvim üstünde gösterilecek hint metni */
  readonly calendarHint = computed<string>(() => {
    const sym = this.symbol();
    const min = this.minDateStr();
    if (!min) return `${sym} için fiyat geçmişi yükleniyor…`;
    const d = new Date(min + 'T12:00:00');
    const label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${sym} için varsayılan başlangıç: ${label}`;
  });

  readonly dateLabel = computed(() => formatTurkishDate(this.dateStr()));
  readonly logoColor = computed(() => symbolColor(this.symbol()));

  readonly symbolBadge = computed(() => {
    const s = this.symbol();
    if (this.isCryptoTm()) {
      const base = s.endsWith('USDT') ? s.slice(0, -4) : s;
      return base.slice(0, 3);
    }
    return s.slice(0, 2);
  });

  readonly pickerOpen = signal(false);
  readonly pickerQuery = signal('');
  readonly pickerIndex = signal(0);
  private readonly pickerSearch = viewChild<ElementRef<HTMLInputElement>>('pickerSearch');

  readonly selectedLabel = computed(() => {
    const s = this.symbol();
    if (this.isCryptoTm()) {
      const base = s.endsWith('USDT') ? s.slice(0, -4) : s;
      return `${base} / USDT`;
    }
    const fx = this.forexOptions().find((o) => o.symbol === s);
    return fx?.label ?? s;
  });

  private readonly forexOptions = computed(() =>
    this.indexService
      .quotes()
      .filter((q) => isForexSymbol(q.symbol))
      .map((q) => ({ symbol: q.symbol, label: q.displayName })),
  );

  private readonly allPickerOptions = computed<PickerOption[]>(() => {
    if (this.isCryptoTm()) {
      const all = Object.keys(this.cryptoMarket.priceMap()).sort((a, b) => a.localeCompare(b));
      const current = this.symbol();
      const list = current && !all.includes(current) ? [current, ...all] : all;
      return list.map((sym) => {
        const base = sym.endsWith('USDT') ? sym.slice(0, -4) : sym;
        return {
          value: sym,
          title: `${base} / USDT`,
          subtitle: sym,
          badge: base.slice(0, 3),
          color: symbolColor(sym),
        };
      });
    }

    const stocks = this.market.symbolOptions();
    const stockList = stocks.length ? [...stocks] : ['THYAO', 'GARAN', 'AKBNK'];
    const current = this.symbol();
    if (current && !stockList.includes(current) && !isForexSymbol(current)) {
      stockList.unshift(current);
    }

    const opts: PickerOption[] = [];
    for (const fx of this.forexOptions()) {
      opts.push({
        value: fx.symbol,
        title: fx.label,
        subtitle: fx.symbol,
        badge: fx.symbol.slice(0, 2),
        color: symbolColor(fx.symbol),
      });
    }
    for (const s of stockList) {
      opts.push({
        value: s,
        title: s,
        badge: s.slice(0, 2),
        color: symbolColor(s),
      });
    }
    return opts;
  });

  readonly pickerOptions = computed(() => {
    const q = this.pickerQuery().trim().toUpperCase();
    const all = this.allPickerOptions();
    if (!q) return all.slice(0, 80);
    return all
      .filter(
        (o) =>
          o.value.toUpperCase().includes(q) ||
          o.title.toUpperCase().includes(q) ||
          (o.subtitle?.toUpperCase().includes(q) ?? false),
      )
      .slice(0, 80);
  });

  readonly instrumentLabel = computed(() => {
    if (this.isCryptoTm()) return 'COİN SEÇ';
    return isForexSymbol(this.symbol()) ? 'DÖVİZ / ALTIN SEÇ' : 'HİSSE SEÇ';
  });

  readonly subtitle = computed(() => {
    if (this.isCryptoTm())
      return 'O tarihte belirlediğin USD tutarla bu coini alsaydın bugün ne olurdu?';
    const sym = this.symbol();
    if (isForexSymbol(sym)) {
      const label = this.parityLabel(sym).toLocaleLowerCase('tr-TR');
      return `O tarihte belirlediğin tutarla ${label} alsaydın bugün ne olurdu?`;
    }
    return 'O tarihte belirlediğin tutarla bu hisseyi alsaydın bugün ne olurdu?';
  });

  readonly lotLabel = computed(() => {
    if (this.isCryptoTm()) return 'MİKTAR';
    switch (this.symbol()) {
      case 'USDTRY': return 'USD MİKTARI';
      case 'EURTRY': return 'EUR MİKTARI';
      case 'GRAMALTIN': return 'GRAM';
      default: return 'LOT';
    }
  });

  readonly wageInfo = computed(() => {
    const iso = this.dateStr();
    if (!iso || iso.length < 7) return 'Asgari ücret için tarih seç…';
    const year = +iso.slice(0, 4);
    const month = +iso.slice(5, 7);
    const wage = getMinimumWage(iso);
    const inv = wage * (this.pct() / 100);
    const totalMonths = (new Date().getFullYear() - year) * 12 - (month - 1);
    const fmt = (n: number) =>
      n >= 100 ? formatInteger(n) : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const modeTxt =
      this.mode() === 'lump'
        ? `tek seferde: <b>${fmt(inv)} ₺</b>`
        : `her ay: <b>${fmt(inv)} ₺</b> × ~${Math.max(totalMonths, 1)} ay`;
    const note =
      year < 2005
        ? ` <span style="opacity:.7">(2005 öncesi Yeni TL karşılığı)</span>`
        : '';
    return `${year} asgari ücreti: <b>${fmt(wage)} ₺</b>${note} → ${modeTxt}`;
  });

  readonly canSimulate = computed(
    () => !!this.calc() && !this.calc()!.error && this.calc()!.valueSeries.length > 0,
  );

  readonly canCalculate = computed(() => {
    const d = this.dateStr();
    return !!d && d.length >= 10 && !this.loading();
  });

  /** Sembol değişince / açılışta en erken tarihe snap için */
  private dateSnapSymbol = '';

  // ── "Aynı gün X TL ile ne alsaydın?" ────────────────────
  readonly leaders = signal<TimeMachineLeaders | null>(null);
  readonly altTab = signal<'bist' | 'crypto'>('bist');
  private leadersRequestedFor = '';

  /** Karşılaştırma paneli için tek seferlik tutar (DCA olsa bile). */
  readonly altInvestAmount = computed(() => {
    if (this.investMode() === 'custom') {
      return Math.max(0, this.customAmount());
    }
    const iso = this.dateStr();
    if (!iso || iso.length < 7) return 0;
    return getMinimumWage(iso) * (this.pct() / 100);
  });

  readonly altCurrency = computed(() => (this.altTab() === 'crypto' ? '$' : '₺'));

  readonly altPanelTitle = computed(() => {
    const amt = this.altInvestAmount();
    const unit = this.isCryptoTm() ? '$' : '₺';
    if (amt <= 0) return 'Aynı gün ne alsaydın?';
    return `Aynı gün ${formatMoneyAmount(amt)} ${unit} ile ne alsaydın?`;
  });

  readonly parityChips = computed(() => {
    const lb = this.leaders();
    const bySym = new Map((lb?.parity ?? []).map((p) => [p.symbol, p] as const));
    return PARITY_SYMBOLS.map((symbol) => ({
      symbol,
      leader: bySym.get(symbol) ?? null,
    }));
  });

  readonly altList = computed<TimeMachineLeader[]>(() => {
    const lb = this.leaders();
    if (!lb) return [];
    return this.altTab() === 'crypto' ? lb.crypto : lb.bist;
  });

  readonly altWhen = computed(() => {
    const row = this.altList()[0] ?? this.leaders()?.parity[0];
    if (!row) return '';
    return `${formatTurkishDate(row.startDate)} → ${formatTurkishDate(row.endDate)}`;
  });

  readonly altEmptyText = computed(() =>
    this.altTab() === 'crypto'
      ? 'Bu tarihte henüz kripto verisi yok.'
      : 'Bu tarihte BIST verisi bulunamadı.',
  );

  readonly altNote = computed(() => {
    const top = this.altList()[0];
    if (!top) return 'Getiriler seçilen günün kapanışından son kapanışa kadar hesaplanır.';
    const amt = this.altInvestAmount();
    const unit = this.altCurrency();
    const grown = this.grownFromReturn(top.returnPct);
    const suffix =
      this.altTab() === 'crypto'
        ? 'Getiriler fiyat değişimidir.'
        : 'Getiri TV AdjustedClose (temettü/bölünme düzeltilmiş) oranıdır; gösterilen fiyatlar ham kapanıştır.';
    if (amt <= 0) return suffix;
    return `O gün ${formatMoneyAmount(amt)} ${unit} ile ${this.altTitle(top)} alsaydın bugün ~${formatMoneyAmount(grown)} ${unit} olurdu. ${suffix}`;
  });

  constructor() {
    // Modal açılınca: her yeni açılışta formu sıfırla, sembolü ayarla
    effect(() => {
      const open = this.modals.active() === 'timeMachine';
      if (!open) {
        this.tmWasOpen = false;
        this.dateSnapSymbol = '';
        this.closePicker();
        return;
      }

      const crypto = this.modals.timeMachineMarket() === 'crypto';
      if (!this.tmWasOpen) {
        this.tmWasOpen = true;
        this.resetFormForOpen(crypto);
      }

      const sym = this.modals.stockSymbol();
      if (sym) {
        this.symbol.set(crypto ? sym : isIndexSymbol(sym) ? 'THYAO' : sym);
      }
      if (!crypto && !this.market.symbolOptions().length) this.market.loadMarket();
      if (!crypto && !this.indexService.quotes().length) this.indexService.loadQuotes();
      if (crypto) {
        if (this.cryptoMarket.tickersCount() === 0) this.cryptoMarket.load();
        if (sym) {
          this.cryptoApi.getMeta(sym).subscribe({
            next: (m) => this.cryptoEarliest.set(m.earliestDataDate),
            error: () => this.cryptoEarliest.set(null),
          });
        }
      }
    });

    // Açılışta veya sembol değişince → o enstrümanın en erken tarihine snap.
    // Kullanıcı elle tarih seçtiyse (aynı sembolde) ezme.
    effect(() => {
      if (this.modals.active() !== 'timeMachine') return;
      const sym = this.symbol();
      const min = this.minDateStr();
      if (!min) return;

      const symbolChanged = sym !== this.dateSnapSymbol;
      const dateEmpty = !this.dateStr() || this.dateStr().length < 10;
      const belowMin = this.dateStr() < min;

      if (symbolChanged || dateEmpty || belowMin) {
        this.dateSnapSymbol = sym;
        this.dateStr.set(min);
      }
    });

    // Earliest bilinmiyorsa hisse detayından çek (GUNDG vb.)
    effect(() => {
      if (this.modals.active() !== 'timeMachine') return;
      if (this.isCryptoTm()) return;
      const sym = this.symbol();
      if (!sym || isIndexSymbol(sym) || isForexSymbol(sym)) return;
      if (this.market.getEarliestDate(sym)) {
        this.bistEarliestOverride.set(null);
        return;
      }
      this.stockApi.getStock(sym).subscribe({
        next: (d) => {
          const earliest = d.earliestDataDate ?? null;
          if (this.symbol() === sym) this.bistEarliestOverride.set(earliest);
        },
        error: () => {
          if (this.symbol() === sym) this.bistEarliestOverride.set(null);
        },
      });
    });

    // Seçilen tarih değişince alternatifleri getir
    effect(() => {
      if (this.modals.active() !== 'timeMachine') return;
      this.altTab.set(this.isCryptoTm() ? 'crypto' : 'bist');
      const iso = this.dateStr();
      if (!iso || iso.length < 10) return;
      this.loadLeaders(iso);
    });
  }

  /** Her açılışta önceki girdi / sonucu temizle. Tarih min gelince effect doldurur. */
  private resetFormForOpen(crypto: boolean): void {
    this.mode.set('lump');
    this.pct.set(50);
    this.investMode.set(crypto ? 'custom' : 'wage');
    this.customAmount.set(0);
    this.dateStr.set('');
    this.dateSnapSymbol = '';
    this.bistEarliestOverride.set(null);
    this.resetCalc();
    this.leaders.set(null);
    this.leadersRequestedFor = '';
    this.altTab.set(crypto ? 'crypto' : 'bist');
    this.pickerQuery.set('');
    this.closePicker();
  }

  /** returnPct → bugünkü tutar (AdjustedClose oranı için multiple alanına güvenme). */
  grownFromReturn(returnPct: number): number {
    const amt = this.altInvestAmount();
    if (amt <= 0) return 0;
    return amt * (1 + returnPct / 100);
  }

  returnMultiple(returnPct: number): number {
    return 1 + returnPct / 100;
  }

  private loadLeaders(iso: string): void {
    if (this.leadersRequestedFor === iso) return;
    this.leadersRequestedFor = iso;

    this.market.getTimeMachineLeaders(iso).subscribe({
      next: (r) => {
        if (this.leadersRequestedFor !== iso) return;
        this.leaders.set(r.bist.length || r.crypto.length || r.parity.length ? r : null);
      },
      error: () => {
        if (this.leadersRequestedFor === iso) this.leaders.set(null);
      },
    });
  }

  setAltTab(tab: 'bist' | 'crypto'): void {
    this.altTab.set(tab);
  }

  parityLabel(symbol: string): string {
    return PARITY_LABELS[symbol as ParitySymbol] ?? symbol;
  }

  parityIcon(symbol: string): string {
    return PARITY_ICONS[symbol as ParitySymbol] ?? '💱';
  }

  altTitle(leader: TimeMachineLeader): string {
    return leader.symbol.endsWith('USDT') ? leader.symbol.slice(0, -4) : leader.symbol;
  }

  altBadge(symbol: string): string {
    return this.altTitle({ symbol } as TimeMachineLeader).slice(0, 3);
  }

  /** Yüz binleri aşan getirilerde ondalık göstermek gürültü yaratıyor. */
  pctText(pct: number): string {
    const sign = pct >= 0 ? '+' : '';
    return Math.abs(pct) >= 1000
      ? `${sign}%${formatInteger(pct)}`
      : `${sign}%${formatNumber(pct)}`;
  }

  multipleText(multiple: number): string {
    if (multiple >= 1000) return `${formatInteger(multiple)}×`;
    return `${multiple.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}×`;
  }

  onClose(): void {
    this.closePicker();
    this.showSim.set(false);
    this.modals.close();
  }

  togglePicker(): void {
    if (this.pickerOpen()) {
      this.closePicker();
      return;
    }
    this.pickerOpen.set(true);
    this.pickerQuery.set('');
    this.pickerIndex.set(0);
    queueMicrotask(() => this.pickerSearch()?.nativeElement.focus());
  }

  closePicker(): void {
    this.pickerOpen.set(false);
    this.pickerQuery.set('');
    this.pickerIndex.set(0);
  }

  onPickerQuery(q: string): void {
    this.pickerQuery.set(q);
    this.pickerIndex.set(0);
  }

  onPickerNav(ev: Event, delta: number): void {
    ev.preventDefault();
    const n = this.pickerOptions().length;
    if (!n) return;
    this.pickerIndex.update((i) => (i + delta + n) % n);
  }

  onPickerEnter(ev: Event): void {
    ev.preventDefault();
    const list = this.pickerOptions();
    const pick = list[this.pickerIndex()] ?? list[0];
    if (pick) this.pickSymbol(pick.value);
  }

  pickSymbol(sym: string): void {
    this.closePicker();
    this.onSymbolChange(sym);
  }

  @HostListener('document:mousedown', ['$event'])
  onDocMouseDown(ev: MouseEvent): void {
    if (!this.pickerOpen()) return;
    const path = ev.composedPath?.() ?? [];
    const inside = path.some(
      (n) => n instanceof HTMLElement && n.classList.contains('sym-combo'),
    );
    if (!inside) this.closePicker();
  }

  onSymbolChange(sym: string): void {
    if (isIndexSymbol(sym)) return;
    this.symbol.set(sym);
    this.resetCalc();
    if (this.isCryptoTm()) {
      this.cryptoApi.getMeta(sym).subscribe({
        next: (m) => this.cryptoEarliest.set(m.earliestDataDate),
        error: () => this.cryptoEarliest.set(null),
      });
    }
  }

  onDateChange(iso: string): void {
    this.dateStr.set(iso);
    this.resetCalc();
  }

  onPctChange(val: number): void {
    this.pct.set(+val);
    this.resetCalc();
  }

  onCustomAmountChange(val: number): void {
    this.customAmount.set(+val || 0);
    this.resetCalc();
  }

  setMode(m: TimeMachineMode): void {
    this.mode.set(m);
    this.resetCalc();
  }

  setInvestMode(m: InvestMode): void {
    this.investMode.set(m);
    this.resetCalc();
  }

  resetCalc(): void {
    this.calc.set(null);
    this.showSim.set(false);
    this.simTrigger.set(0);
  }

  calculate(): void {
    if (!this.canCalculate()) return;

    if (isIndexSymbol(this.symbol())) {
      this.calc.set({
        symbol: this.symbol(),
        mode: this.mode(),
        invested: 0,
        currentValue: 0,
        gainPct: 0,
        initialLots: 0,
        lots: 0,
        buyPrice: 0,
        currentPrice: 0,
        series: [],
        valueSeries: [],
        lotSeries: [],
        lotEvents: [],
        dateLabel: this.dateLabel(),
        dividendsReceived: 0,
        dividendsReinvested: 0,
        lotsFromReinvestment: 0,
        cashRemaining: 0,
        storyLines: [],
        error:
          'Endeksler için Zaman Makinesi desteklenmiyor. Endeks bileşimi değişir; temettü / bedelli / bedelsiz hisse bazında yansıtılamaz. Bir hisse veya döviz seç.',
      });
      return;
    }

    this.loading.set(true);
    this.showSim.set(false);

    const amount =
      this.investMode() === 'custom' && this.customAmount() > 0
        ? this.customAmount()
        : undefined;

    this.market
      .calculateInvestment(
        this.symbol(),
        this.dateStr(),
        this.pct(),
        this.mode(),
        amount,
        this.isCryptoTm() ? 'crypto' : 'bist',
      )
      .subscribe({
        next: (r) => {
          this.calc.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.calc.set({
            symbol: this.symbol(),
            mode: this.mode(),
            invested: 0,
            currentValue: 0,
            gainPct: 0,
            initialLots: 0,
            lots: 0,
            buyPrice: 0,
            currentPrice: 0,
            series: [],
            valueSeries: [],
            lotSeries: [],
            lotEvents: [],
            dateLabel: this.dateLabel(),
            dividendsReceived: 0,
            dividendsReinvested: 0,
            lotsFromReinvestment: 0,
            cashRemaining: 0,
            storyLines: [],
            error: 'Hesaplama başarısız. Backend bağlantısını kontrol et.',
          });
          this.loading.set(false);
        },
      });
  }

  runSim(): void {
    if (!this.canSimulate()) return;
    this.showSim.set(true);
    this.simTrigger.update((n) => n + 1);
  }
}
