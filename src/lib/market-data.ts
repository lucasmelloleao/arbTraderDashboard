// ── Dados de mercado agregados de fontes públicas (server-side) ─────────────
// CoinGecko (preço/capitalização/volume), Binance Futures (funding rate/Open
// Interest), DefiLlama (TVL) e DexScreener (pares DEX). Todas sem chave de API.
// Todas as chamadas são tolerantes a falha: se uma fonte cair, segue com as outras.

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const BINANCE_FUTURES = 'https://fapi.binance.com/fapi/v1';
const DEFILLAMA_BASE = 'https://api.llama.fi';
const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex';

// Mapa de "símbolo curto" → id do CoinGecko
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token',
  DOT: 'polkadot',
  LTC: 'litecoin',
  ARB: 'arbitrum',
  OP: 'optimism',
  SUI: 'sui',
  TON: 'the-open-network',
  TRX: 'tron',
  NEAR: 'near',
  APT: 'aptos',
  FARTCOIN: 'fartcoin',
  MYX: 'myx-finance',
  PEPE: 'pepe',
  WIF: 'dogwifcoin',
  BONK: 'bonk',
  SHIB: 'shiba-inu',
  UNI: 'uniswap',
  AAVE: 'aave',
  MKR: 'maker',
  LDO: 'lido-dao',
  RNDR: 'render-token',
  INJ: 'injective-protocol',
  SEI: 'sei-network',
  TIA: 'celestia',
  JUP: 'jupiter-exchange-solana',
  RAY: 'raydium',
  USDT: 'tether',
  USDC: 'usd-coin',
};

// Nomes comuns de moedas (para detectar "bitcoin", "dogecoin", "ethereum"... na pergunta)
const COIN_NAMES: Record<string, string> = {
  BITCOIN: 'BTC',
  ETHEREUM: 'ETH',
  SOLANA: 'SOL',
  'BINANCE COIN': 'BNB',
  RIPPLE: 'XRP',
  DOGECOIN: 'DOGE',
  CARDANO: 'ADA',
  'AVALANCHE': 'AVAX',
  CHAINLINK: 'LINK',
  POLYGON: 'MATIC',
  POLKADOT: 'DOT',
  LITECOIN: 'LTC',
  ARBITRUM: 'ARB',
  OPTIMISM: 'OP',
  'SUI': 'SUI',
  'THE OPEN NETWORK': 'TON',
  TRON: 'TRX',
  NEAR: 'NEAR',
  APTOS: 'APT',
  PEPE: 'PEPE',
  SHIBA: 'SHIB',
  'SHIBA INU': 'SHIB',
  UNISWAP: 'UNI',
  RENDER: 'RNDR',
  INJECTIVE: 'INJ',
  CELESTIA: 'TIA',
  JUPITER: 'JUP',
  RAYDIUM: 'RAY',
  'FART COIN': 'FARTCOIN',
};

// Lista de símbolos conhecidos do mercado (para detecção por símbolo na pergunta)
const KNOWN_SYMBOLS = new Set<string>([
  ...Object.keys(COINGECKO_IDS),
  'BCH', 'ETC', 'FIL', 'ATOM', 'XLM', 'ALGO', 'VET', 'ICP', 'HBAR', 'APT', 'IMX',
  'STX', 'CRV', 'GALA', 'SAND', 'MANA', 'AXS', 'ENJ', 'CHZ', 'KAVA', 'GMX', 'DYDX',
  'SNX', 'COMP', 'CRV', 'LUNC', 'LUNA', 'CRO', 'FTM', 'SUSHI', '1INCH', 'ENS',
  'AAVE', 'GRT', 'EOS', 'XTZ', 'ZEC', 'DASH', 'XMR', 'NEO', 'IOTA', 'THETA',
]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Converte "BTC-PERP", "BTC/USDT", "BTCUSDT" → "BTC"
function baseSymbol(sym?: string | null): string {
  if (!sym) return '';
  const clean = String(sym).toUpperCase().split(/[/\-:]/)[0];
  return clean.replace(/(USDT|USDC|BUSD|USD|PERP|FUT|SPOT)$/i, '');
}

// Detecta moedas citadas em uma pergunta/texto (por símbolo tipo "BTC" ou nome
// tipo "bitcoin"/"dogecoin"). Retorna símbolos únicos em maiúsculas.
export function detectCoinsInText(text?: string | null): string[] {
  if (!text) return [];
  const upper = text.toUpperCase();
  const found = new Set<string>();

  // 1. Por nome (ex: "bitcoin", "dogecoin", "shiba inu")
  for (const [name, sym] of Object.entries(COIN_NAMES)) {
    if (upper.includes(name)) found.add(sym);
  }

  // 2. Por símbolo (ex: "BTC", "ETH", "SOL") — usa fronteiras de palavra
  for (const sym of KNOWN_SYMBOLS) {
    const re = new RegExp(`(^|[^A-Z0-9])${sym}($|[^A-Z0-9])`);
    if (re.test(upper)) found.add(sym);
  }

  // 3. Por símbolo dentro de pares (ex: "BTCUSDT", "SOL/USDT")
  const pairMatch = upper.match(/([A-Z0-9]{2,12})\/?(?:USDT|USDC|BUSD|USD|PERP)/g);
  if (pairMatch) {
    for (const m of pairMatch) {
      const base = m.replace(/(USDT|USDC|BUSD|USD|PERP)$/i, '').replace('/', '');
      if (base.length >= 2 && base.length <= 12) found.add(base);
    }
  }

  return Array.from(found).slice(0, 6);
}

// Resolve o id do CoinGecko para um símbolo desconhecido (busca dinâmica).
async function resolveCoinGeckoId(symbol: string): Promise<string | null> {
  const cached = COINGECKO_IDS[symbol];
  if (cached) return cached;
  try {
    const data = await fetchJson(`${COINGECKO_BASE}/search?query=${encodeURIComponent(symbol)}`, 5000);
    const coins = data?.coins;
    if (Array.isArray(coins) && coins.length > 0) {
      const match = coins.find(
        (c: any) => c.symbol?.toUpperCase() === symbol.toUpperCase() || c.name?.toUpperCase() === symbol
      ) || coins[0];
      if (match?.id) {
        COINGECKO_IDS[symbol] = match.id; // cacheia para próximas chamadas
        return match.id;
      }
    }
  } catch { /* não encontrou */ }
  return null;
}

async function fetchJson(url: string, timeoutMs = 6000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export interface MarketCoin {
  symbol: string;
  name: string;
  priceUsd: number | null;
  priceBrl: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  high24hUsd: number | null;
  low24hUsd: number | null;
}

export interface MarketPerpData {
  symbol: string;
  markPriceUsd: number | null;
  fundingRatePct: number | null; // % por 8h (valor da Binance Futures *100)
  openInterestUsd: number | null;
}

export interface MarketData {
  coins: MarketCoin[];           // CoinGecko
  perps: MarketPerpData[];       // Binance Futures
  defiLlama: {
    totalTvlUsd: number | null;
    topProtocols: { name: string; tvlUsd: number }[];
  } | null;
  dexPairs: {
    pairAddress: string;
    baseSymbol: string;
    dexName: string;
    priceUsd: number | null;
    volume24hUsd: number | null;
    liquidityUsd: number | null;
  }[];
  fetchedAt: string;
}

// Busca dados de mercado das moedas + perpétuos mais relevantes (símbolos das
// posições do usuário + top mercado). Tolerante a falhas por fonte.
export async function fetchMarketData(extraSymbols: string[] = []): Promise<MarketData> {
  const result: MarketData = {
    coins: [],
    perps: [],
    defiLlama: null,
    dexPairs: [],
    fetchedAt: new Date().toISOString(),
  };

  // ── Símbolos de interesse ──
  const interest = new Set<string>(['BTC', 'ETH', 'SOL', ...extraSymbols.map(baseSymbol).filter(Boolean)]);
  const interestArr = Array.from(interest).slice(0, 12); // limite p/ não estourar API

  // ── 1. CoinGecko: preço, market cap, volume, %24h, %7d ──
  try {
    const ids = interestArr.map((s) => COINGECKO_IDS[s]).filter(Boolean);
    if (ids.length > 0) {
      const data = await fetchJson(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&order=market_cap_desc&per_page=${ids.length}&page=1&sparkline=false&price_change_percentage=24h,7d`
      );
      if (Array.isArray(data)) {
        for (const c of data) {
          const sym = String(c.symbol || '').toUpperCase();
          result.coins.push({
            symbol: sym,
            name: c.name,
            priceUsd: c.current_price ?? null,
            priceBrl: null, // preenchido abaixo
            marketCapUsd: c.market_cap ?? null,
            volume24hUsd: c.total_volume ?? null,
            change24hPct: c.price_change_percentage_24h_in_currency ?? null,
            change7dPct: c.price_change_percentage_7d_in_currency ?? null,
            high24hUsd: c.high_24h ?? null,
            low24hUsd: c.low_24h ?? null,
          });
        }
      }
    }
    // Busca dinâmica para símbolos sem id mapeado (moedas novas/desconhecidas)
    const unresolved = interestArr.filter((s) => !COINGECKO_IDS[s]);
    for (const sym of unresolved.slice(0, 5)) {
      const id = await resolveCoinGeckoId(sym);
      if (!id) continue;
      const data = await fetchJson(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${id}&price_change_percentage=24h,7d`
      );
      if (Array.isArray(data) && data[0]) {
        const c = data[0];
        result.coins.push({
          symbol: String(c.symbol || '').toUpperCase(),
          name: c.name,
          priceUsd: c.current_price ?? null,
          priceBrl: null,
          marketCapUsd: c.market_cap ?? null,
          volume24hUsd: c.total_volume ?? null,
          change24hPct: c.price_change_percentage_24h_in_currency ?? null,
          change7dPct: c.price_change_percentage_7d_in_currency ?? null,
          high24hUsd: c.high_24h ?? null,
          low24hUsd: c.low_24h ?? null,
        });
      }
      await sleep(250); // rate-limit CoinGecko
    }
  } catch { /* CoinGecko indisponível */ }

  // ── 1b. Preços em BRL (CoinGecko vs_currency=brl) — para exibir cotação em reais ──
  try {
    const ids = interestArr.map((s) => COINGECKO_IDS[s]).filter(Boolean);
    if (ids.length > 0) {
      const data = await fetchJson(
        `${COINGECKO_BASE}/coins/markets?vs_currency=brl&ids=${ids.join(',')}&price_change_percentage=24h`
      );
      if (Array.isArray(data)) {
        const brlMap: Record<string, number> = {};
        for (const c of data) {
          brlMap[String(c.symbol || '').toUpperCase()] = c.current_price ?? null;
        }
        for (const coin of result.coins) {
          coin.priceBrl = brlMap[coin.symbol] ?? null;
        }
      }
    }
  } catch { /* BRL indisponível — segue sem */ }

  // Rate-limit leve da CoinGecko (free tier ~10-30 req/min)
  if (result.coins.length === 0) await sleep(250);

  // ── 2. Binance Futures: funding rate + open interest + mark price ──
  try {
    const symbols = interestArr.map((s) => `${s}USDT`);
    const [fundingRes, tickerRes] = await Promise.allSettled([
      fetchJson(`${BINANCE_FUTURES}/premiumIndex`),
      fetchJson(`${BINANCE_FUTURES}/ticker/price?symbols=${JSON.stringify(symbols)}`),
    ]);

    const fundingMap: Record<string, number> = {};
    if (fundingRes.status === 'fulfilled' && Array.isArray(fundingRes.value)) {
      for (const f of fundingRes.value) {
        fundingMap[f.symbol] = Number(f.lastFundingRate || 0) * 100; // → % por 8h
      }
    }
    const priceMap: Record<string, number> = {};
    if (tickerRes.status === 'fulfilled' && Array.isArray(tickerRes.value)) {
      for (const p of tickerRes.value) priceMap[p.symbol] = Number(p.price);
    }

    // Open Interest: endpoint aceita 1 símbolo por chamada → busca em lote paralelo.
    // O valor retornado é em CONTRATOS (unidades da moeda base) → converte para USD usando o mark price.
    const oiMap: Record<string, number> = {};
    await Promise.all(symbols.slice(0, 8).map(async (sym) => {
      try {
        const oi = await fetchJson(`${BINANCE_FUTURES}/openInterest?symbol=${sym}`, 4000);
        const contracts = Number(oi?.openInterest || 0);
        const mark = priceMap[sym] || 0;
        if (contracts > 0 && mark > 0) oiMap[sym] = contracts * mark;
      } catch { /* sem OI para este símbolo */ }
    }));

    for (const sym of symbols) {
      const base = sym.replace('USDT', '');
      if (!fundingMap[sym] && !oiMap[sym] && !priceMap[sym]) continue;
      result.perps.push({
        symbol: `${base}-PERP`,
        markPriceUsd: priceMap[sym] ?? null,
        fundingRatePct: fundingMap[sym] ?? null,
        openInterestUsd: oiMap[sym] ?? null,
      });
    }
  } catch { /* Binance Futures indisponível */ }

  // ── 3. DefiLlama: TVL global + top protocolos ──
  try {
    const protocols = await fetchJson(`${DEFILLAMA_BASE}/protocols`, 8000);
    if (Array.isArray(protocols)) {
      const top = protocols
        .filter((p: any) => !p.misrepresentedTokens && p.tvl > 0)
        .sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0))
        .slice(0, 8)
        .map((p: any) => ({ name: p.name, tvlUsd: Number(p.tvl) || 0 }));

      const chains = await fetchJson(`${DEFILLAMA_BASE}/v2/chains`, 8000);
      let totalTvlUsd: number | null = null;
      if (Array.isArray(chains)) {
        totalTvlUsd = chains.reduce((acc: number, c: any) => acc + (Number(c.tvl) || 0), 0);
      }
      result.defiLlama = { totalTvlUsd, topProtocols: top };
    }
  } catch { /* DefiLlama indisponível */ }

  // ── 4. DexScreener: pares DEX dos tokens de interesse (se houver endereço/par) ──
  // (Sem endereços de contrato conhecidos, usa busca por símbolo apenas para os principais)
  try {
    for (const sym of interestArr.slice(0, 5)) {
      const search = await fetchJson(`${DEXSCREENER_BASE}/search?q=${encodeURIComponent(sym)}`, 5000);
      const pairs = search?.pairs;
      if (Array.isArray(pairs)) {
        const best = pairs
          .filter((p: any) => p.liquidity?.usd > 0)
          .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
          .slice(0, 2);
        for (const p of best) {
          result.dexPairs.push({
            pairAddress: p.pairAddress || '',
            baseSymbol: p.baseToken?.symbol || sym,
            dexName: p.dexId || '',
            priceUsd: parseFloat(p.priceUsd) || null,
            volume24hUsd: parseFloat(p.volume?.h24 || '0') || null,
            liquidityUsd: p.liquidity?.usd ? parseFloat(p.liquidity.usd) : null,
          });
        }
      }
      await sleep(200); // rate limit DexScreener
    }
  } catch { /* DexScreener indisponível */ }

  return result;
}

// ── Preço histórico ─────────────────────────────────────────────────────────

export interface HistoricalPrice {
  symbol: string;
  date: string;          // YYYY-MM-DD
  priceUsd: number | null;
  priceBrl: number | null;
  change24hPct: number | null;
}

// Detecta um período/dia na pergunta: "ontem", "hoje", "3 dias atrás", "semana
// passada", "mês passado", ou datas no calendário ("15/03/2026", "15 de março").
export interface DateQuery {
  daysAgo: number;       // 0 = hoje, 1 = ontem...
  raw: string;           // texto do período encontrado
}

export function detectDateInText(text?: string | null): DateQuery | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // "ontem" → 1 dia atrás
  if (/\bontem\b|\bdia de ontem\b|\byesterday\b/.test(lower)) return { daysAgo: 1, raw: 'ontem' };

  // "hoje", "agora", "atualmente" → hoje
  if (/\bhoje\b|\bagora\b|\batualmente\b|preço atual\b/.test(lower)) return { daysAgo: 0, raw: 'hoje' };

  // "N dias atrás" / "há N dias" / "N days ago"
  const nDays = lower.match(/(?:há|ha|atrás|atras|ago)\s*(\d+)\s*(?:dias|dia|days|day)/) ||
                lower.match(/(\d+)\s*(?:dias|dia|days|day)\s*(?:atrás|atras|ago)/);
  if (nDays) return { daysAgo: Math.min(365, Math.max(0, parseInt(nDays[1], 10))), raw: nDays[0] };

  // "semana passada" / "última semana" → 7 dias atrás
  if (/\b(?:semana passada|última semana|ultima semana|last week|semana anterior)\b/.test(lower)) {
    return { daysAgo: 7, raw: 'semana passada' };
  }

  // "mês passado" / "último mês" → 30 dias atrás
  if (/\b(?:mês passado|mes passado|último mês|ultimo mes|last month)\b/.test(lower)) {
    return { daysAgo: 30, raw: 'mês passado' };
  }

  // "ano passado" → 365 dias atrás
  if (/\b(?:ano passado|last year)\b/.test(lower)) {
    return { daysAgo: 365, raw: 'ano passado' };
  }

  // Datas no calendário: "DD/MM/YYYY", "DD-MM-YYYY", "DD/MM"
  const dateNum = lower.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (dateNum) {
    const day = parseInt(dateNum[1], 10);
    const month = parseInt(dateNum[2], 10);
    const year = dateNum[3] ? parseInt(dateNum[3], 10) : new Date().getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const target = new Date(fullYear, month - 1, day);
      const now = new Date();
      const diff = Math.round((now.getTime() - target.getTime()) / 86400000);
      if (diff >= 0 && diff <= 3650) {
        return { daysAgo: diff, raw: dateNum[0] };
      }
    }
  }

  // "15 de março" / "15 de março de 2026" (meses por extenso)
  const monthNames: Record<string, number> = {
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  for (const [mName, mNum] of Object.entries(monthNames)) {
    const mRe = lower.match(new RegExp(`(\\d{1,2})\\s*(?:de\\s*)?${mName}(?:\\s*de\\s*(\\d{2,4}))?`));
    if (mRe) {
      const day = parseInt(mRe[1], 10);
      const year = mRe[2] ? parseInt(mRe[2], 10) : new Date().getFullYear();
      const fullYear = year < 100 ? 2000 + year : year;
      const target = new Date(fullYear, mNum - 1, day);
      const diff = Math.round((new Date().getTime() - target.getTime()) / 86400000);
      if (diff >= 0 && diff <= 3650) {
        return { daysAgo: diff, raw: mRe[0] };
      }
    }
  }

  return null;
}

// Busca o preço histórico (fechamento aproximado) de uma moeda em uma data.
// Usa a API de histórico do CoinGecko (últimos 365 dias). Tolerante a falhas.
export async function fetchHistoricalPrice(symbol: string, daysAgo: number): Promise<HistoricalPrice | null> {
  const id = await resolveCoinGeckoId(symbol);
  if (!id) return null;

  const target = new Date();
  target.setDate(target.getDate() - daysAgo);
  const dateStr = target.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // Preço em USD na data (endpoint /coins/{id}/history)
    const usdRes = await fetchJson(`${COINGECKO_BASE}/coins/${id}/history?date=${dateStr}&localization=false`, 6000);
    const usdPrice = usdRes?.market_data?.current_price?.usd ?? null;

    // Preço em BRL
    let brlPrice: number | null = null;
    try {
      const brlRes = await fetchJson(`${COINGECKO_BASE}/coins/${id}/history?date=${dateStr}&localization=false&vs_currencies=brl`, 6000);
      brlPrice = brlRes?.market_data?.current_price?.brl ?? null;
    } catch { /* BRL indisponível */ }

    // Variação % naquele dia (aprox.: usa o fechamento do dia anterior se disponível)
    let change24hPct: number | null = null;
    try {
      const prev = new Date(target);
      prev.setDate(prev.getDate() - 1);
      const prevRes = await fetchJson(`${COINGECKO_BASE}/coins/${id}/history?date=${prev.toISOString().slice(0, 10)}&localization=false`, 6000);
      const prevPrice = prevRes?.market_data?.current_price?.usd;
      if (usdPrice && prevPrice && prevPrice > 0) {
        change24hPct = ((usdPrice - prevPrice) / prevPrice) * 100;
      }
    } catch { /* sem variação */ }

    return {
      symbol,
      date: dateStr,
      priceUsd: usdPrice,
      priceBrl: brlPrice,
      change24hPct,
    };
  } catch {
    return null;
  }
}
