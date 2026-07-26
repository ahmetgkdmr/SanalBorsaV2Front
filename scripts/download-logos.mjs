/**
 * BIST + kripto logolarını güvenilir CDN'lerden indirir.
 * Kaynaklar: TradingView (BIST SVG), CoinCap / crypto-icons / CoinGecko (kripto PNG)
 *
 * Kullanım: node scripts/download-logos.mjs
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

// Bazı Windows ortamlarında ara CA zinciri eksik olabiliyor
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BIST_DIR = join(ROOT, 'public', 'photos', 'bist');
const CRYPTO_DIR = join(ROOT, 'public', 'photos', 'crypto');
const API = process.env.API_URL || 'http://localhost:5042';

const TV_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: 'https://www.tradingview.com',
  Referer: 'https://www.tradingview.com/',
};

const concurrency = 10;

function requestBuffer(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const opts = {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: `${u.pathname}${u.search}`,
      method: 'GET',
      headers,
      agent: u.protocol === 'https:' ? insecureAgent : undefined,
      timeout: 30000,
    };
    const req = lib.request(opts, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        requestBuffer(new URL(res.headers.location, url).href, headers).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode || 0, headers: res.headers, buf });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function mapPool(items, limit, fn) {
  const ret = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return ret;
}

async function downloadTo(url, dest, headers = {}) {
  const { status, headers: rh, buf } = await requestBuffer(url, headers);
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
  const type = String(rh['content-type'] || '').toLowerCase();
  if (type.includes('text/html')) throw new Error('HTML response');
  if (!buf.length) throw new Error('empty');
  await writeFile(dest, buf);
}

async function fetchJson(url, headers = {}, body) {
  if (!body) {
    const { status, buf } = await requestBuffer(url, { Accept: 'application/json', ...headers });
    if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
    return JSON.parse(buf.toString('utf8'));
  }
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = Buffer.from(body);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
        agent: insecureAgent,
        timeout: 60000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function fetchBistLogos() {
  console.log('BIST: TradingView scanner…');
  const body = JSON.stringify({
    filter: [{ left: 'exchange', operation: 'equal', right: 'BIST' }],
    options: { lang: 'en' },
    symbols: { query: { types: [] }, tickers: [] },
    columns: ['logoid', 'name'],
    sort: { sortBy: 'name', sortOrder: 'asc' },
    range: [0, 800],
  });
  const json = await fetchJson('https://scanner.tradingview.com/turkey/scan', TV_HEADERS, body);
  const rows = (json.data || [])
    .map((row) => {
      const ticker = String(row.s || '').replace(/^BIST:/, '');
      const logoid = row.d?.[0];
      return logoid ? { symbol: ticker.toUpperCase(), logoid } : null;
    })
    .filter(Boolean);

  console.log(`BIST: ${rows.length} logoid bulundu, indiriliyor…`);
  let ok = 0;
  let skip = 0;
  let fail = 0;
  const failed = [];

  await mapPool(rows, concurrency, async ({ symbol, logoid }) => {
    const dest = join(BIST_DIR, `${symbol}.svg`);
    if (await exists(dest)) {
      skip++;
      return;
    }
    const url = `https://s3-symbol-logo.tradingview.com/${logoid}.svg`;
    try {
      await downloadTo(url, dest, TV_HEADERS);
      ok++;
      if ((ok + skip) % 50 === 0) console.log(`  BIST ilerleme: ${ok + skip}/${rows.length}`);
    } catch (e) {
      fail++;
      failed.push({ symbol, logoid, err: String(e.message || e) });
    }
  });

  console.log(`BIST: ok=${ok} skip=${skip} fail=${fail}`);
  return { ok, skip, fail, failed };
}

async function buildCoinGeckoMap() {
  const map = new Map();
  console.log('Crypto: CoinGecko markets haritası…');
  for (let page = 1; page <= 12; page++) {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false`;
    try {
      const { status, buf } = await requestBuffer(url, { Accept: 'application/json' });
      if (status === 429) {
        console.warn('CoinGecko rate limit — bekleniyor…');
        await new Promise((r) => setTimeout(r, 15000));
        page--;
        continue;
      }
      if (status < 200 || status >= 300) break;
      const list = JSON.parse(buf.toString('utf8'));
      if (!Array.isArray(list) || !list.length) break;
      for (const c of list) {
        const sym = String(c.symbol || '').toUpperCase();
        if (!sym || !c.image || map.has(sym)) continue;
        map.set(sym, c.image);
      }
      console.log(`  CoinGecko page ${page}: map=${map.size}`);
      await new Promise((r) => setTimeout(r, 1300));
    } catch (e) {
      console.warn(`  CoinGecko page ${page} hata:`, e.message || e);
      break;
    }
  }
  console.log(`Crypto: CoinGecko map size=${map.size}`);
  return map;
}

function cryptoCandidateUrls(base, geckoMap) {
  const lower = base.toLowerCase();
  const urls = [
    `https://assets.coincap.io/assets/icons/${lower}@2x.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${lower}.png`,
  ];
  const g = geckoMap.get(base.toUpperCase());
  if (g) urls.push(g);
  return urls;
}

async function fetchCryptoLogos() {
  console.log('Crypto: API sembolleri…');
  const { status, buf } = await requestBuffer(`${API}/api/crypto`);
  if (status < 200 || status >= 300) throw new Error(`API crypto ${status}`);
  const tickers = JSON.parse(buf.toString('utf8'));
  const bases = [
    ...new Set(
      (tickers || []).map((t) =>
        String(t.baseAsset || t.BaseAsset || '')
          .toUpperCase()
          .trim(),
      ),
    ),
  ].filter(Boolean);

  console.log(`Crypto: ${bases.length} unique base`);
  const geckoMap = await buildCoinGeckoMap();

  let ok = 0;
  let skip = 0;
  let fail = 0;
  const failed = [];

  await mapPool(bases, 6, async (base) => {
    const dest = join(CRYPTO_DIR, `${base}.png`);
    if (await exists(dest)) {
      skip++;
      return;
    }
    let saved = false;
    for (const url of cryptoCandidateUrls(base, geckoMap)) {
      try {
        await downloadTo(url, dest);
        ok++;
        saved = true;
        break;
      } catch {
        /* try next */
      }
    }
    if (!saved) {
      fail++;
      failed.push({ symbol: base });
    } else if ((ok + skip) % 40 === 0) {
      console.log(`  Crypto ilerleme: ${ok + skip}/${bases.length}`);
    }
  });

  console.log(`Crypto: ok=${ok} skip=${skip} fail=${fail}`);
  return { ok, skip, fail, failed };
}

async function main() {
  await mkdir(BIST_DIR, { recursive: true });
  await mkdir(CRYPTO_DIR, { recursive: true });

  const bist = await fetchBistLogos();
  const crypto = await fetchCryptoLogos();

  const manifest = {
    downloadedAt: new Date().toISOString(),
    sources: {
      bist: 'TradingView s3-symbol-logo (SVG)',
      crypto: 'CoinCap / cryptocurrency-icons / CoinGecko',
    },
    bist,
    crypto,
  };
  await writeFile(
    join(ROOT, 'public', 'photos', 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  console.log('Tamam. Manifest: public/photos/manifest.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
