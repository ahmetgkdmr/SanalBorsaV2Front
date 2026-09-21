import { getMinimumWage } from '../constants/app.constants';
import { formatInteger } from './format.util';

/**
 * Zaman makinesinde girilen tutar **seçilen tarihin parasıdır** — bugünün değil.
 * Bu ayrım kullanıcıya sezgisel gelmiyor: 2010 için "100.000 ₺" yazan biri bugünün
 * 100.000 ₺'sini düşünüyor, oysa o gün bu para ~173 asgari ücret ediyordu ve sonuç
 * ona göre çıkıyor.
 *
 * Buradaki yardımcı, tutarı o dönemin **asgari ücreti** cinsinden ifade eder — çünkü
 * "kaç asgari ücret" her dönemde aynı şeyi anlatan, herkesin sezgisel olarak anladığı
 * bir ölçü. Sonuç yalnızca BİLGİLENDİRME amaçlıdır; hiçbir hesaba girmez.
 *
 * Çıpa neden asgari ücret? Satın alma gücü çevrimi seçilen çıpaya göre ciddi şekilde
 * değişiyor (1993 için dolar ~4.100 ₺, altın ~49.100 ₺, asgari ücret ~19.200 ₺ veriyor).
 * Asgari ücret ikisinin ortasında duruyor, repoda 1990'a kadar mevcut ve ürünün dilinde
 * zaten kullanılıyor ("Asgari Ücret Bazlı" modu).
 */
export interface EraMoneyContext {
  /** Seçilen tarihteki net asgari ücret (yeni TL birimiyle). */
  wageThen: number;
  /** Ekranda gösterilecek asgari ücret — 2005 öncesinde eski TL nominali. */
  wageThenLabel: string;
  /** Tutar o gün kaç asgari ücret ediyordu. */
  wageCount: number;
  /** "≈ 173 asgari ücret" gibi okunur etiket. */
  wageCountLabel: string;
  /** Aynı sayıda asgari ücretin bugünkü karşılığı. */
  todayEquivalent: number;
  todayEquivalentLabel: string;
  /** Seçilen tarih 2005 redenominasyonundan önce mi. */
  isOldEra: boolean;
  /** 2005 öncesinde tutarın eski TL nominali ("1.000.000.000 TL" gibi); değilse null. */
  oldTlLabel: string | null;
}

/** 1 yeni TL = 1.000.000 eski TL (2005 redenominasyonu, 6 sıfır). */
const OLD_TL_FACTOR = 1_000_000;

const REDENOMINATION_DATE = '2005-01-01';

/**
 * @param isoDate Seçilen tarih (yyyy-MM-dd).
 * @param amount  Girilen tutar — **yeni TL biriminde** (2005 öncesi girdiler çağıran
 *                tarafından zaten 1.000.000'a bölünmüş olarak gelir).
 */
export function buildEraMoneyContext(isoDate: string, amount: number): EraMoneyContext | null {
  if (!isoDate || isoDate.length < 7 || !Number.isFinite(amount) || amount <= 0) return null;

  const wageThen = getMinimumWage(isoDate);
  const wageNow = getMinimumWage(new Date().toISOString().slice(0, 10));
  if (wageThen <= 0 || wageNow <= 0) return null;

  const wageCount = amount / wageThen;
  const todayEquivalent = wageCount * wageNow;
  const isOldEra = isoDate < REDENOMINATION_DATE;

  return {
    wageThen,
    wageThenLabel: isOldEra
      ? `${formatInteger(wageThen * OLD_TL_FACTOR)} TL`
      : `${formatInteger(wageThen)} ₺`,
    wageCount,
    wageCountLabel: formatWageCount(wageCount),
    todayEquivalent,
    todayEquivalentLabel: `${formatInteger(todayEquivalent)} ₺`,
    isOldEra,
    oldTlLabel: isOldEra ? `${formatInteger(amount * OLD_TL_FACTOR)} TL` : null,
  };
}

/**
 * "0,3 asgari ücret" / "1,5 asgari ücret" / "173 asgari ücret" — büyüklüğe göre hane.
 * Tam sayıya yuvarlanan küçük değerler ("0 asgari ücret") anlamsız olurdu.
 */
function formatWageCount(count: number): string {
  if (count >= 100) return `${formatInteger(count)} asgari ücret`;
  if (count >= 10) return `${count.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} asgari ücret`;
  return `${count.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} asgari ücret`;
}
