/**
 * Eksik kripto logolarını tamamlar: CoinGecko + TradingView BINANCE.
 * Kullanım: node scripts/fill-crypto-logos.mjs
 */
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CRYPTO_DIR = join(ROOT, 'public', 'photos', 'crypto');
const API = process.env.API_URL || 'http://localhost:5042';

const TV_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: 'https://www.tradingview.com',
  Referer: 'https://www.tradingview.com/',
};

function requestBuffer(url, headers = {}, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const payload = body ? Buffer.from(body) : null;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: `${u.pathname}${u.search}`,
        method,
        headers: {
          ...headers,
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': payload.length }
            : {}),
        },
        agent: u.protocol === 'https:' ? insecureAgent : undefined,
        timeout: 45000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          requestBuffer(new URL(res.headers.location, url).href, headers).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode || 0, headers: res.headers, buf: Buffer.concat(chunks) }),
        );
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function mapPool(items, limit, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

async function main() {
  await mkdir(CRYPTO_DIR, { recursive: true });

  const { buf } = await requestBuffer(`${API}/api/crypto`);
  const tickers = JSON.parse(buf.toString('utf8'));
  const bases = [
    ...new Set(
      tickers.map((t) => String(t.baseAsset || '').toUpperCase().trim()).filter(Boolean),
    ),
  ];

  const missing = [];
  for (const b of bases) {
    const hasPng = await exists(join(CRYPTO_DIR, `${b}.png`));
    const hasSvg = await exists(join(CRYPTO_DIR, `${b}.svg`));
    if (!hasPng && !hasSvg) missing.push(b);
  }
  console.log(`Eksik: ${missing.length} / ${bases.length}`);

  // CoinGecko map
  const gecko = new Map();
  for (let page = 1; page <= 16; page++) {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false`;
    const { status, buf: b } = await requestBuffer(url, { Accept: 'application/json' });
    console.log(`CoinGecko page ${page}: HTTP ${status}`);
    if (status === 429) {
      await new Promise((r) => setTimeout(r, 20000));
      page--;
      continue;
    }
    if (status !== 200) break;
    const list = JSON.parse(b.toString('utf8'));
    if (!Array.isArray(list) || !list.length) break;
    for (const c of list) {
      const sym = String(c.symbol || '').toUpperCase();
      if (sym && c.image && !gecko.has(sym)) gecko.set(sym, c.image);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`CoinGecko map: ${gecko.size}`);

  let filled = 0;
  const still = [];

  await mapPool(missing, 5, async (base) => {
    const destPng = join(CRYPTO_DIR, `${base}.png`);
    const urls = [];
    if (gecko.has(base)) urls.push(gecko.get(base));
    const lower = base.toLowerCase();
    urls.push(
      `https://assets.coincap.io/assets/icons/${lower}@2x.png`,
      `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${lower}.png`,
    );

    for (const url of urls) {
      try {
        const { status, buf: b, headers } = await requestBuffer(url);
        if (status !== 200 || !b.length) continue;
        const type = String(headers['content-type'] || '');
        if (type.includes('html')) continue;
        await writeFile(destPng, b);
        filled++;
        return;
      } catch {
        /* next */
      }
    }
    still.push(base);
  });

  console.log(`CoinGecko/CDN ile doldurulan: ${filled}, kalan: ${still.length}`);

  // TradingView BINANCE logoids for remaining
  console.log('TradingView BINANCE scanner…');
  const body = JSON.stringify({
    filter: [
      { left: 'exchange', operation: 'equal', right: 'BINANCE' },
      { left: 'name', operation: 'match', right: 'USDT' },
    ],
    options: { lang: 'en' },
    symbols: { query: { types: [] }, tickers: [] },
    columns: ['logoid', 'name', 'description'],
    sort: { sortBy: 'name', sortOrder: 'asc' },
    range: [0, 2000],
  });
  const scan = await requestBuffer(
    'https://scanner.tradingview.com/crypto/scan',
    { ...TV_HEADERS, 'Content-Type': 'application/json' },
    'POST',
    body,
  );
  console.log(`TV scan HTTP ${scan.status}`);
  let tvMap = new Map();
  if (scan.status === 200) {
    const json = JSON.parse(scan.buf.toString('utf8'));
    for (const row of json.data || []) {
      const ticker = String(row.s || ''); // BINANCE:BTCUSDT
      const m = ticker.match(/BINANCE:([A-Z0-9]+)USDT$/i);
      if (!m) continue;
      const logoid = row.d?.[0];
      if (logoid) tvMap.set(m[1].toUpperCase(), logoid);
    }
  }
  console.log(`TV logoid map: ${tvMap.size}`);

  let tvOk = 0;
  const finalFail = [];
  await mapPool(still, 8, async (base) => {
    const logoid = tvMap.get(base);
    if (!logoid) {
      finalFail.push(base);
      return;
    }
    const dest = join(CRYPTO_DIR, `${base}.svg`);
    try {
      const { status, buf: b } = await requestBuffer(
        `https://s3-symbol-logo.tradingview.com/${logoid}.svg`,
        TV_HEADERS,
      );
      if (status !== 200 || !b.length) {
        finalFail.push(base);
        return;
      }
      await writeFile(dest, b);
      tvOk++;
    } catch {
      finalFail.push(base);
    }
  });

  console.log(`TV SVG: ${tvOk}, tamamen eksik: ${finalFail.length}`);
  if (finalFail.length) console.log('Eksikler:', finalFail.join(', '));

  const manifestPath = join(ROOT, 'public', 'photos', 'manifest.json');
  let manifest = {};
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    /* ignore */
  }
  manifest.cryptoFill = {
    at: new Date().toISOString(),
    filledFromGecko: filled,
    filledFromTv: tvOk,
    stillMissing: finalFail,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
