import { NextRequest, NextResponse } from 'next/server';

// Cache simples em memória símbolo -> url do logo
const cache = new Map<string, { url: string | null; at: number }>();
const TTL = 24 * 60 * 60 * 1000; // 24h

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || '')
    .toUpperCase()
    .replace(/(USDT|USDC|BUSD|USDD|TUSD|FDUSD|USD|EUR|BRL|PERP|FUTURES|SPOT)$/i, '');

  if (!symbol) {
    return NextResponse.json({ url: null });
  }

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json({ url: cached.url });
  }

  let url: string | null = null;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`,
      { headers: { accept: 'application/json' }, cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      const coin = Array.isArray(data?.coins) ? data.coins[0] : null;
      url = coin?.large || coin?.thumb || coin?.small || null;
    }
  } catch {
    url = null;
  }

  cache.set(symbol, { url, at: Date.now() });
  return NextResponse.json({ url });
}
