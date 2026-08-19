/** BIST sanal işlem penceresi — Türkiye saati 19:00–09:30 açık. */
export const BIST_CLOSED_CODE = 'BIST_CLOSED';

export const BIST_CLOSED_TITLE = 'Borsa İstanbul kapalı';

export const BIST_CLOSED_MESSAGE =
  'Sanal portföyde BIST alım-satımı, günün kapanış fiyatı netleştikten sonra açılır.\n\n' +
  'İşlem saati: her gün 19:00 – ertesi sabah 09:30 (Türkiye saati).\n\n' +
  'Seans boyunca (09:30–19:00) fiyatlar henüz kesinleşmediği için işlem yapılamaz.\n\n' +
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
  // 19:00 → 09:30
  return mins >= 19 * 60 || mins < 9 * 60 + 30;
}

export function isBistClosedError(message: string | null | undefined): boolean {
  if (!message) return false;
  return message.includes(`[${BIST_CLOSED_CODE}]`) || message.includes('Borsa İstanbul işlemleri şu an kapalı');
}
