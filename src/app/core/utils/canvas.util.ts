/**
 * Paylaşım görseli üreten bileşenlerin ortak çizim yardımcıları.
 *
 * Bunlar bileşen durumundan tamamen bağımsız saf fonksiyonlar — modal'ların içinde
 * durmaları için bir sebep yoktu ve orada iki ayrı kopya hâline gelme riski taşıyorlardı.
 */

/**
 * Yuvarlatılmış dikdörtgen yolu çizer. Tarayıcı yerleşik `roundRect` sunuyorsa onu kullanır,
 * yoksa `arcTo` ile aynı yolu elle kurar (eski Safari sürümleri için).
 */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  const anyCtx = ctx as CanvasRenderingContext2D & { roundRect?: (...a: number[]) => void };
  if (typeof anyCtx.roundRect === 'function') {
    anyCtx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Metni verilen genişliğe göre satırlara böler. Ölçüm o anki `ctx.font` ile yapılır —
 * çağırmadan önce yazı tipi ayarlanmış olmalı.
 */
export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';

  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }

  if (cur) lines.push(cur);
  return lines;
}

/** Bir blob'u dosya olarak indirtir ve oluşturulan object URL'i geri bırakır. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
