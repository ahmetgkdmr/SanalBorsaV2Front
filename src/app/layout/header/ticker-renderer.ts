/**
 * Kayan şerit çizici. Hem Web Worker (OffscreenCanvas) hem de ana iş parçacığı
 * (HTMLCanvasElement) ile çalışır. Çizim döngüsü veri akışından tamamen bağımsızdır:
 * değerler değişse de kayma hiç kesilmez.
 */

export interface TickerChipInput {
  id: string;
  name: string;
  value: string;
  change: string;
  up: boolean;
}

export interface TickerColors {
  text: string;
  muted: string;
  up: string;
  down: string;
  sep: string;
}

interface Chip extends TickerChipInput {
  nameW: number;
  width: number;
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const PAD_X = 14;
const GAP = 6;
const SEP_W = 10;

/** Worker içinde de tarayıcıda da çalışan kare zamanlayıcı. */
function scheduleFrame(cb: (t: number) => void): number {
  const g = globalThis as unknown as {
    requestAnimationFrame?: (cb: (t: number) => void) => number;
  };
  if (typeof g.requestAnimationFrame === 'function') return g.requestAnimationFrame(cb);
  return setTimeout(() => cb(performance.now()), 16) as unknown as number;
}

function cancelFrame(id: number): void {
  const g = globalThis as unknown as { cancelAnimationFrame?: (id: number) => void };
  if (typeof g.cancelAnimationFrame === 'function') g.cancelAnimationFrame(id);
  else clearTimeout(id);
}

export class TickerRenderer {
  private readonly canvas: AnyCanvas;
  private readonly ctx: Ctx2D | null;

  private chips: Chip[] = [];
  private loopWidth = 0;
  private offset = 0;
  private lastTs = 0;
  private frameId = 0;
  private running = false;

  private cssW = 0;
  private cssH = 33;
  private dpr = 1;
  private speed = 55;

  private valSlotW = 96;
  private chgSlotW = 72;

  private colors: TickerColors = {
    text: '#e8edf6',
    muted: '#8593ad',
    up: '#22c98a',
    down: '#f0506e',
    sep: 'rgba(232,237,246,0.14)',
  };

  private readonly fonts = {
    name: '700 10px Archivo, system-ui, sans-serif',
    val: '700 13px "IBM Plex Mono", ui-monospace, monospace',
    chg: '600 11px "IBM Plex Mono", ui-monospace, monospace',
    sep: '400 14px Archivo, system-ui, sans-serif',
  };

  constructor(canvas: AnyCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as Ctx2D | null;
  }

  setSpeed(px: number): void {
    this.speed = px;
  }

  setColors(colors: TickerColors): void {
    this.colors = colors;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = cssH;
    this.dpr = Math.min(Math.max(dpr, 1), 3);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    if (this.ctx) this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.relayout();
  }

  /** Sembol listesi (etiketler) değişti — genişlikler yeniden ölçülür. */
  setChips(list: TickerChipInput[]): void {
    this.chips = list.map((c) => ({ ...c, nameW: 0, width: 0 }));
    this.relayout();
  }

  /** Sadece rakamlar değişti — genişlik sabit, yerleşim korunur. */
  setValues(values: TickerChipInput[]): void {
    if (!this.chips.length) return;
    const map = new Map(values.map((v) => [v.id, v]));
    for (const chip of this.chips) {
      const v = map.get(chip.id);
      if (!v) continue;
      chip.value = v.value;
      chip.change = v.change;
      chip.up = v.up;
    }

    // İlk değerler geldiğinde (ya da büyüklük mertebesi değiştiğinde) sütun genişliğini
    // bir kez düzelt. Eşik sayesinde her saniyelik güncellemede yerleşim oynamaz.
    const slots = this.measureSlots();
    if (Math.abs(slots.val - this.valSlotW) > 2 || Math.abs(slots.chg - this.chgSlotW) > 2) {
      this.relayout();
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    this.frameId = scheduleFrame((t) => this.tick(t));
  }

  stop(): void {
    this.running = false;
    if (this.frameId) cancelFrame(this.frameId);
    this.frameId = 0;
  }

  /**
   * Değer/değişim sütunlarının genişliği, sabit bir "en kötü ihtimal" şablonu yerine
   * ekranda gerçekten bulunan en uzun metne göre ölçülür — aksi halde kısa değerlerde
   * (ör. "1.876,85") etiketle rakam arasında geniş bir boşluk kalıyordu.
   * Sütun sabit kalır (rakamlar hizalı akar), sadece gereksiz payı atılır.
   */
  private measureSlots(): { val: number; chg: number } {
    const ctx = this.ctx;
    if (!ctx) return { val: 0, chg: 0 };

    ctx.font = this.fonts.val;
    let val = 0;
    for (const chip of this.chips) {
      if (chip.value) val = Math.max(val, ctx.measureText(chip.value).width);
    }
    // Değerler henüz gelmediyse makul bir başlangıç payı bırak.
    if (val === 0) val = ctx.measureText('000.000,00').width;

    ctx.font = this.fonts.chg;
    let chg = 0;
    for (const chip of this.chips) {
      if (chip.change) chg = Math.max(chg, ctx.measureText(chip.change).width);
    }
    if (chg === 0) chg = ctx.measureText('▼ %00,00').width;

    return { val: Math.ceil(val), chg: Math.ceil(chg) };
  }

  private relayout(): void {
    const ctx = this.ctx;
    if (!ctx || !this.chips.length) {
      this.loopWidth = 0;
      return;
    }

    const slots = this.measureSlots();
    this.valSlotW = slots.val;
    this.chgSlotW = slots.chg;

    let total = 0;
    ctx.font = this.fonts.name;
    for (const chip of this.chips) {
      chip.nameW = ctx.measureText(chip.name.toUpperCase()).width;
      chip.width = PAD_X * 2 + chip.nameW + GAP + this.valSlotW + GAP + this.chgSlotW + SEP_W;
      total += chip.width;
    }

    this.loopWidth = total;
    if (this.loopWidth > 0 && this.offset >= this.loopWidth) {
      this.offset %= this.loopWidth;
    }
  }

  private tick(ts: number): void {
    if (!this.running) return;

    const dt = Math.min(0.25, Math.max(0, (ts - this.lastTs) / 1000));
    this.lastTs = ts;

    if (this.loopWidth > 0) {
      this.offset += this.speed * dt;
      if (this.offset >= this.loopWidth) this.offset %= this.loopWidth;
    }

    this.draw();
    this.frameId = scheduleFrame((t) => this.tick(t));
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.cssW, this.cssH);
    if (!this.chips.length || this.loopWidth <= 0) return;

    const midY = this.cssH / 2;
    let x = -this.offset;
    while (x + this.loopWidth < 0) x += this.loopWidth;

    while (x < this.cssW) {
      this.drawSet(ctx, x, midY);
      x += this.loopWidth;
    }
  }

  private drawSet(ctx: Ctx2D, originX: number, midY: number): void {
    let x = originX;
    ctx.textBaseline = 'middle';

    for (const chip of this.chips) {
      if (x + chip.width < 0) {
        x += chip.width;
        continue;
      }
      if (x > this.cssW) break;

      let cursor = x + PAD_X;

      ctx.font = this.fonts.name;
      ctx.fillStyle = this.colors.muted;
      ctx.textAlign = 'left';
      ctx.fillText(chip.name.toUpperCase(), cursor, midY);
      cursor += chip.nameW + GAP;

      ctx.font = this.fonts.val;
      ctx.fillStyle = this.colors.text;
      ctx.textAlign = 'right';
      ctx.fillText(chip.value, cursor + this.valSlotW, midY);
      cursor += this.valSlotW + GAP;

      ctx.font = this.fonts.chg;
      ctx.fillStyle = chip.change ? (chip.up ? this.colors.up : this.colors.down) : this.colors.muted;
      ctx.textAlign = 'left';
      ctx.fillText(chip.change, cursor, midY);
      cursor += this.chgSlotW + 4;

      ctx.font = this.fonts.sep;
      ctx.fillStyle = this.colors.sep;
      ctx.fillText('|', cursor, midY);

      x += chip.width;
    }
  }
}

/** Worker ↔ ana iş parçacığı mesajları. */
export type TickerMessage =
  | { type: 'init'; canvas: OffscreenCanvas; cssW: number; cssH: number; dpr: number; speed: number; colors: TickerColors }
  | { type: 'resize'; cssW: number; cssH: number; dpr: number }
  | { type: 'colors'; colors: TickerColors }
  | { type: 'chips'; chips: TickerChipInput[] }
  | { type: 'values'; values: TickerChipInput[] }
  | { type: 'stop' };
