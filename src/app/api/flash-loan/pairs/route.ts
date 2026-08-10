import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NETWORK_ORDER = ['solana', 'arbitrum', 'polygon'];

const REASON_LABELS: Record<string, string> = {
  sem_pool: 'Sem pool',
  unilateral: 'Pool unilateral',
  suspeito: 'Spread suspeito',
  sem_liquidez: 'Sem liquidez',
  spread_extremo: 'Spread extremo',
};

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const mongoose = (await import('mongoose')).default;
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Banco de dados indisponível' }, { status: 503 });
    }
    const collection = db.collection('token_registry');

    const raw = await collection.find({}).toArray();

    const networks: Record<string, { processed: any[]; banned: any[] }> = {};
    for (const net of NETWORK_ORDER) {
      networks[net] = { processed: [], banned: [] };
    }

    for (const doc of raw) {
      const net = NETWORK_ORDER.includes(doc.network) ? doc.network : 'solana';
      const item = {
        mint: doc.mint,
        symbol: doc.symbol || 'UNKNOWN',
        colateralMint: doc.colateralMint || '',
        colateralSymbol: doc.colateralSymbol || '',
        pairSymbol: doc.pairSymbol || (doc.symbol || 'UNKNOWN'),
        status: doc.status,
        reason: doc.reason || '',
        reasonLabel: REASON_LABELS[doc.reason] || doc.reason || '',
        lastSpreadPct: doc.lastSpreadPct || 0,
        discardedAt: doc.discardedAt || null,
        lastSeenAt: doc.lastSeenAt || null,
      };
      if (doc.status === 'positive') {
        networks[net].processed.push(item);
      } else if (doc.status === 'discarded') {
        networks[net].banned.push(item);
      }
    }

    for (const net of NETWORK_ORDER) {
      // Ordena pelo melhor (maior) lastSpreadPct — os pares com maior spread
      // (positivo = oportunidade, menos negativo = menos perda) ficam no topo.
      networks[net].processed.sort((a, b) => (b.lastSpreadPct || 0) - (a.lastSpreadPct || 0));
      networks[net].banned.sort((a, b) => (b.lastSpreadPct || 0) - (a.lastSpreadPct || 0));
    }

    return NextResponse.json({ networks, counts: {
      solana: { processed: networks.solana.processed.length, banned: networks.solana.banned.length },
      arbitrum: { processed: networks.arbitrum.processed.length, banned: networks.arbitrum.banned.length },
      polygon: { processed: networks.polygon.processed.length, banned: networks.polygon.banned.length },
    }});
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
