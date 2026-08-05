/** ABD hisseleri sanal işlem penceresi — New York saati 16:00–09:30 açık (NYSE seans dışı). */
export const US_CLOSED_CODE = 'US_CLOSED';

export const US_CLOSED_TITLE = 'ABD hisse alım-satımı kapalı';

export const US_CLOSED_MESSAGE =
  'Sanal portföyde ABD hisse alım-satımı, günün kapanış fiyatı netleştikten sonra açılır.\n\n' +
  'İşlem saati: her gün 16:00 – ertesi sabah 09:30 (New York saati).\n\n' +
  'Seans boyunca (09:30–16:00 ET) fiyatlar henüz kesinleşmediği için işlem yapılamaz.';

export function isUsTradingOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const mins = hour * 60 + minute;
  // 16:00 → 09:30
  return mins >= 16 * 60 || mins < 9 * 60 + 30;
}

export function isUsClosedError(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    message.includes(`[${US_CLOSED_CODE}]`) ||
    message.includes('ABD hisse alım-satım penceresi şu an kapalı')
  );
}
