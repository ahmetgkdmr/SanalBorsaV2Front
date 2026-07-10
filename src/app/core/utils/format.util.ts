export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatInteger(value: number): string {
  return Math.round(value).toLocaleString('tr-TR');
}

export function formatTurkishDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTime(date = new Date()): string {
  return date.toLocaleTimeString('tr-TR');
}

export function changePercent(current: number, base: number): number {
  if (!base) return 0;
  return ((current - base) / base) * 100;
}

export function symbolColor(symbol: string): string {
  const palette = [
    '#c8102e', '#00857c', '#e30613', '#004a8f', '#00337f', '#1f4e9c', '#5b6770', '#b1122b',
    '#003da5', '#e84e0f', '#0072bc', '#d6001c', '#003478', '#ffc900', '#f9a01b', '#9d1d27',
    '#00539b', '#c9a227', '#1b3a6b', '#2e7d32', '#f26522', '#e2001a', '#00427a', '#6a1b9a',
  ];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}
