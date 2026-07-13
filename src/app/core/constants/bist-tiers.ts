/** Filtre sekmesi tanımı */
export interface IndexTab {
  id: string;       // API'ye gönderilen filtre değeri ('all' veya endeks sembolü)
  label: string;    // Sekme etiketi
  group?: string;   // Görsel gruplama (opsiyonel)
}

/** Tüm filtre sekmeleri — sıralı */
export const INDEX_TABS: IndexTab[] = [
  { id: 'all',   label: 'Tümü' },

  // ── Büyüklük endeksleri ────────────────────────────────────────────────
  { id: 'XU030', label: 'BIST 30',  group: 'Büyüklük' },
  { id: 'XU050', label: 'BIST 50',  group: 'Büyüklük' },
  { id: 'XU100', label: 'BIST 100', group: 'Büyüklük' },

  // ── Sektör endeksleri ──────────────────────────────────────────────────
  { id: 'XBANK', label: 'Bankacılık',    group: 'Sektör' },
  { id: 'XUTEK', label: 'Teknoloji',     group: 'Sektör' },
  { id: 'XUSIN', label: 'Sınai',         group: 'Sektör' },
  { id: 'XUHIZ', label: 'Hizmetler',     group: 'Sektör' },
  { id: 'XUMAL', label: 'Mali',          group: 'Sektör' },
  { id: 'XGIDA', label: 'Gıda & İçecek', group: 'Sektör' },
  { id: 'XKMYA', label: 'Kimya',         group: 'Sektör' },
  { id: 'XELKT', label: 'Elektrik',      group: 'Sektör' },
  { id: 'XTAST', label: 'Taş Toprak',    group: 'Sektör' },
  { id: 'XMANA', label: 'Maden',         group: 'Sektör' },
  { id: 'XSPOR', label: 'Spor',          group: 'Sektör' },

  // ── Özel endeksler ─────────────────────────────────────────────────────
  { id: 'XKTUM', label: 'Katılım',       group: 'Özel' },
  { id: 'XKURY', label: 'Kur. Yönetim', group: 'Özel' },
];

/**
 * `bistIndices` dizisinden kart rozeti üretir.
 * En yüksek kademe önceliklidir: BIST 30 > 50 > 100 > diğer > ""
 */
export function tierBadge(bistIndices: string[] | null | undefined): string {
  if (!bistIndices?.length) return '';
  if (bistIndices.includes('XU030')) return 'BIST 30';
  if (bistIndices.includes('XU050')) return 'BIST 50';
  if (bistIndices.includes('XU100')) return 'BIST 100';

  // Sektör veya özel endeks rozeti
  const sectorMap: Record<string, string> = {
    XBANK: 'BANKA', XUTEK: 'TEK', XUSIN: 'SINAİ', XUHIZ: 'HİZMET',
    XUMAL: 'MALİ', XGIDA: 'GIDA', XKMYA: 'KİMYA', XELKT: 'ELK',
    XTAST: 'TAŞ', XMANA: 'MADEN', XSPOR: 'SPOR',
    XKTUM: 'KATILIM', XKURY: 'KUR.YÖN.',
  };
  for (const idx of bistIndices) {
    if (sectorMap[idx]) return sectorMap[idx];
  }
  return '';
}
