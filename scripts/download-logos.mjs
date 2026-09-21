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
const US_DIR = join(ROOT, 'public', 'photos', 'us');
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


/**
 * ABD hisseleri: TradingView "america" scanner'ı NASDAQ/NYSE/AMEX'in tamamını (10.000+ kayıt)
 * döndürüyor. Bizim evrenimiz ~500 sembol olduğu için tüm listeyi çekip KENDİ sembollerimizle
 * kesiştiriyoruz — böylece binlerce gereksiz logo indirilmiyor.
 *
 * TradingView aynı ticker'ı birden fazla borsada listeleyebiliyor (ör. NYSE:XYZ ve AMEX:XYZ);
 * ilk eşleşen kazanır, sembol başına tek dosya yazılır.
 */
/** Şirket adından TradingView logo slug'ı adayları üretir (en olasıdan en genele). */
function slugCandidates(name, symbol) {
  const out = [];
  if (name) {
    const base = String(name)
      .toLowerCase()
      .replace(/[.,'"]/g, '')
      .replace(
        /\b(inc|corp|corporation|company|co|plc|ltd|limited|the|holdings?|group|class [a-z])\b/g,
        ' ',
      )
      .replace(/&/g, 'and')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (base) out.push(base);
    const firstWord = String(name).toLowerCase().split(/[\s,.]+/)[0];
    if (firstWord && firstWord !== base) out.push(firstWord);
  }
  out.push(symbol.toLowerCase().replace('-', '.'));
  return [...new Set(out.filter(Boolean))];
}

async function fetchUsLogos() {
  console.log('US: API sembolleri…');
  const symbols = new Set();
  const names = new Map();
  let page = 1;
  while (true) {
    const { status, buf } = await requestBuffer(`${API}/api/us-stocks?page=${page}&pageSize=200`);
    if (status < 200 || status >= 300) throw new Error(`API us-stocks ${status}`);
    const json = JSON.parse(buf.toString('utf8'));
    for (const item of json.items || []) {
      if (!item.symbol) continue;
      const sym = String(item.symbol).toUpperCase();
      symbols.add(sym);
      if (item.name) names.set(sym, String(item.name));
    }
    if (!json.hasNextPage) break;
    page++;
  }
  console.log(`US: ${symbols.size} sembol bizim evrenimizde`);

  console.log('US: TradingView scanner…');
  const body = JSON.stringify({
    filter: [{ left: 'exchange', operation: 'in_range', right: ['NASDAQ', 'NYSE', 'AMEX'] }],
    options: { lang: 'en' },
    symbols: { query: { types: [] }, tickers: [] },
    columns: ['logoid', 'name'],
    sort: { sortBy: 'name', sortOrder: 'asc' },
    range: [0, 20000],
  });
  const json = await fetchJson('https://scanner.tradingview.com/america/scan', TV_HEADERS, body);

  // TradingView çok sınıflı hisselerde NOKTA kullanıyor (BRK.B), bizim veritabanımızda TİRE
  // var (BRK-B) — eşleştirmede iki yazım da denenir.
  const seen = new Set();
  const rows = [];
  for (const row of json.data || []) {
    const tvTicker = String(row.s || '').split(':').pop()?.toUpperCase();
    const logoid = row.d?.[0];
    if (!tvTicker || !logoid) continue;

    const ours = symbols.has(tvTicker)
      ? tvTicker
      : symbols.has(tvTicker.replace('.', '-'))
        ? tvTicker.replace('.', '-')
        : null;

    if (!ours || seen.has(ours)) continue;
    seen.add(ours);
    rows.push({ symbol: ours, logoid });
  }

  // Kalanlar: scanner'da hiç dönmeyen (farklı borsa, ör. CBOE) ya da logoid'i boş gelenler.
  // TradingView logo dosyaları şirket adından türeyen bir slug'la adlandırıldığı için,
  // kendi veritabanımızdaki şirket adından slug üretip doğrudan deniyoruz.
  const stillMissing = [...symbols].filter((x) => !seen.has(x));
  if (stillMissing.length) {
    console.log(`US: ${stillMissing.length} sembol scanner'da yok, isimden slug deneniyor…`);
    for (const sym of stillMissing) {
      for (const slug of slugCandidates(names.get(sym), sym)) {
        try {
          const { status } = await requestBuffer(
            `https://s3-symbol-logo.tradingview.com/${slug}.svg`,
            TV_HEADERS,
          );
          if (status === 200) {
            rows.push({ symbol: sym, logoid: slug });
            seen.add(sym);
            break;
          }
        } catch {
          /* sonraki adayı dene */
        }
      }
    }
  }

  const missing = [...symbols].filter((x) => !seen.has(x));
  console.log(`US: ${rows.length} logo kaynağı bulundu, ${missing.length} sembolde logo yok`);
  if (missing.length) console.log(`  logosuz: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '…' : ''}`);

  let ok = 0;
  let skip = 0;
  let fail = 0;
  const failed = [];

  await mapPool(rows, concurrency, async ({ symbol, logoid }) => {
    const dest = join(US_DIR, `${symbol}.svg`);
    if (await exists(dest)) {
      skip++;
      return;
    }
    const url = `https://s3-symbol-logo.tradingview.com/${logoid}.svg`;
    try {
      await downloadTo(url, dest, TV_HEADERS);
      ok++;
      if ((ok + skip) % 50 === 0) console.log(`  US ilerleme: ${ok + skip}/${rows.length}`);
    } catch (e) {
      fail++;
      failed.push({ symbol, logoid, err: String(e.message || e) });
    }
  });

  console.log(`US: ok=${ok} skip=${skip} fail=${fail}`);
  return { ok, skip, fail, failed, missing };
}

/**
 * Bileşenin okuduğu katalog. Diskte gerçekten VAR OLAN dosyalardan üretilir — böylece
 * katalog ile dosya sistemi hiç ayrışmaz ve arayüz olmayan bir logoyu istemeye çalışıp
 * 404 almaz (bkz. StockLogoComponent.logoExt).
 */
async function writeAvailableCatalog() {
  const { readdir } = await import('node:fs/promises');

  async function scan(dir) {
    const map = {};
    let files = [];
    try {
      files = await readdir(dir);
    } catch {
      return map;
    }
    for (const f of files) {
      const m = /^(.+)\.(svg|png)$/i.exec(f);
      if (!m) continue;
      const key = m[1].toUpperCase();
      const ext = m[2].toLowerCase();
      (map[key] ||= []).push(ext);
    }
    for (const k of Object.keys(map)) map[k] = [...new Set(map[k])].sort();
    return map;
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    bist: await scan(BIST_DIR),
    crypto: await scan(CRYPTO_DIR),
    us: await scan(US_DIR),
  };

  await writeFile(
    join(ROOT, 'public', 'photos', 'available.json'),
    JSON.stringify(catalog),
    'utf8',
  );
  console.log(
    `available.json yazıldı — bist=${Object.keys(catalog.bist).length} ` +
      `crypto=${Object.keys(catalog.crypto).length} us=${Object.keys(catalog.us).length}`,
  );
}

async function main() {
  await mkdir(BIST_DIR, { recursive: true });
  await mkdir(CRYPTO_DIR, { recursive: true });
  await mkdir(US_DIR, { recursive: true });

  const only = process.argv[2];   // ör. "us" → sadece ABD

  const bist = only && only !== 'bist' ? null : await fetchBistLogos();
  const crypto = only && only !== 'crypto' ? null : await fetchCryptoLogos();
  const us = only && only !== 'us' ? null : await fetchUsLogos();

  const manifest = {
    downloadedAt: new Date().toISOString(),
    sources: {
      bist: 'TradingView s3-symbol-logo (SVG)',
      crypto: 'CoinCap / cryptocurrency-icons / CoinGecko',
      us: 'TradingView s3-symbol-logo (SVG)',
    },
    bist,
    crypto,
    us,
  };
  await writeFile(
    join(ROOT, 'public', 'photos', 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  await writeAvailableCatalog();
  console.log('Tamam. Manifest: public/photos/manifest.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
