/** BIST sanal işlem penceresi — Türkiye saati 18:45–10:00 açık. */
export const BIST_CLOSED_CODE = 'BIST_CLOSED';

export const BIST_CLOSED_TITLE = 'Borsa İstanbul kapalı';

export const BIST_CLOSED_MESSAGE =
  'Sanal portföyde BIST alım-satımı, günün kapanış fiyatı netleştikten sonra açılır.\n\n' +
  'İşlem saati: her gün 18:45 – ertesi sabah 10:00 (Türkiye saati).\n\n' +
  'Seans boyunca (10:00–18:45) fiyatlar henüz kesinleşmediği için işlem yapılamaz.\n\n' +
  'Kripto alım-satımı 7/24 açıktır.';

export function isBistTradingOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const mins = hour * 60 + minute;
  // 18:45 → 10:00
  return mins >= 18 * 60 + 45 || mins < 10 * 60;
}

export function isBistClosedError(message: string | null | undefined): boolean {
  if (!message) return false;
  return message.includes(`[${BIST_CLOSED_CODE}]`) || message.includes('Borsa İstanbul işlemleri şu an kapalı');
}
