/**
 * ABD hisseleri sanal işlem penceresi — New York saati 16:25–09:30 açık (NYSE seans dışı).
 * 16:25, backend'in ham (16:10 ET) VE düzeltilmiş (16:20 ET) fiyat senkronlarının İKİSİ de
 * bittikten sonra gelecek şekilde seçildi (bkz. NyseTradingHours.cs) — eskiden 16:00'daydı,
 * senkrondan önce açılıyordu, bu da henüz güncellenmemiş (bir önceki günün) fiyatla işlem
 * yapılabilmesi riski taşıyordu.
 *
 * US_TRADING_ENABLED = false — proje sohbeti: ABD hisselerinde kurumsal olay verisi tek kaynak
 * (Yahoo Finance), KAP gibi çapraz doğrulanabilir resmi bir kaynak yok; spin-off/merger gibi
 * olayları da hiç yakalayamıyoruz. Bu yüzden alım-satım bilinçli olarak kapalı; saat penceresi
 * mantığı ileride tekrar açmak için olduğu gibi bırakıldı.
 */
export const US_TRADING_ENABLED = false;

export const US_CLOSED_CODE = 'US_CLOSED';

export const US_CLOSED_TITLE = 'ABD hisse alım-satımı kapalı';

export const US_CLOSED_MESSAGE = 'Şu an sadece BIST ve kripto tarafında alım satım yapabilirsiniz.';

export function isUsTradingOpen(now: Date = new Date()): boolean {
  if (!US_TRADING_ENABLED) return false;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const mins = hour * 60 + minute;
  // 16:25 → 09:30
  return mins >= 16 * 60 + 25 || mins < 9 * 60 + 30;
}

export function isUsClosedError(message: string | null | undefined): boolean {
  if (!message) return false;
  return message.includes(`[${US_CLOSED_CODE}]`) || message.includes(US_CLOSED_MESSAGE);
}
