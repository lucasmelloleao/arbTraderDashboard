import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import ExchangeKey from '@/models/ExchangeKey';
import { withAuth } from '@/lib/auth';
import { encryptSecretKey } from '@/lib/encryption';

const CTRADER_IDS = ['ctrader', 'pepperstone'];
const SECRET_FIELDS = ['apiSecret', 'clientSecret', 'accessToken', 'refreshToken'];
const HIDDEN_FIELDS = '-' + SECRET_FIELDS.join(' -');

function isCtrader(exchangeId: string): boolean {
  return CTRADER_IDS.includes(exchangeId);
}

function encryptFields(body: any, userId: string, exchangeId: string): Record<string, string> {
  const authContext = `${userId}-${exchangeId}`;
  const out: Record<string, string> = {};
  for (const f of SECRET_FIELDS) {
    const v = body[f];
    if (v && typeof v === 'string' && v.trim() !== '') {
      out[f] = encryptSecretKey(v.trim(), authContext);
    }
  }
  return out;
}

export const GET = withAuth(async (req: NextRequest, userId: string) => {
    try {
        await connectMongo();
        
        const exchanges = await ExchangeKey.find({ userId }).select(HIDDEN_FIELDS).sort({ createdAt: -1 });
        return NextResponse.json({ success: true, exchanges });
    } catch (e: any) {
        return NextResponse.json({ success: false, reason: e.message }, { status: 500 });
    }
});

export const POST = withAuth(async (req: NextRequest, userId: string) => {
    try {
        await connectMongo();
        const body = await req.json();
        
        const { exchangeId, name, apiKey, apiSecret } = body;
        const isCtraderKey = isCtrader(exchangeId);

        // cTrader exige clientId + clientSecret (+ accessToken). CEX exige apiKey + apiSecret.
        const missingCtrader = isCtraderKey && (!body.clientId || !body.clientSecret);
        if (!exchangeId || !name || (!isCtraderKey && (!apiKey || !apiSecret)) || (isCtraderKey && missingCtrader)) {
            return NextResponse.json({ success: false, reason: 'Missing required fields' }, { status: 400 });
        }

        const encrypted = encryptFields(body, userId, exchangeId);

        const exchangeKey = new ExchangeKey({
            userId,
            exchangeId,
            name: name.trim(),
            // Para cTrader, espelha clientId em apiKey (o campo apiKey é required no schema)
            apiKey: isCtraderKey ? (body.clientId || '').trim() : apiKey.trim(),
            apiSecret: encrypted.apiSecret || (isCtraderKey ? 'ctrader' : encryptSecretKey(apiSecret.trim(), `${userId}-${exchangeId}`)),
            active: true,
            ...(isCtraderKey ? {
                clientId: (body.clientId || '').trim(),
                clientSecret: encrypted.clientSecret || '',
                accessToken: encrypted.accessToken || '',
                refreshToken: encrypted.refreshToken || '',
                accountId: body.accountId ? String(body.accountId).trim() : '',
                environment: body.environment === 'demo' ? 'demo' : 'live',
            } : {}),
        });

        await exchangeKey.save();

        const responseData = exchangeKey.toObject();
        for (const f of SECRET_FIELDS) delete responseData[f];

        return NextResponse.json({ success: true, exchange: responseData }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ success: false, reason: e.message }, { status: 500 });
    }
});

export const DELETE = withAuth(async (req: NextRequest, userId: string) => {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        if (!id) return NextResponse.json({ success: false, reason: 'ID is required' }, { status: 400 });

        await connectMongo();
        const deleted = await ExchangeKey.findOneAndDelete({ _id: id, userId });
        
        if (!deleted) return NextResponse.json({ success: false, reason: 'Exchange not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ success: false, reason: e.message }, { status: 500 });
    }
});

export const PUT = withAuth(async (req: NextRequest, userId: string) => {
    try {
        await connectMongo();
        const body = await req.json();
        const { id, exchangeId, name, apiKey, apiSecret } = body;
        const isCtraderKey = isCtrader(exchangeId);

        if (!id || !exchangeId || !name || (!isCtraderKey && !apiKey)) {
            return NextResponse.json({ success: false, reason: 'Missing required fields' }, { status: 400 });
        }

        const updateData: any = {
            exchangeId,
            name: name.trim(),
            ...(!isCtraderKey ? { apiKey: apiKey.trim() } : {}),
        };

        if (isCtraderKey) {
            if (body.clientId) updateData.clientId = String(body.clientId).trim();
            if (body.accountId) updateData.accountId = String(body.accountId).trim();
            if (body.environment) updateData.environment = body.environment === 'demo' ? 'demo' : 'live';
            const encrypted = encryptFields(body, userId, exchangeId);
            for (const [k, v] of Object.entries(encrypted)) {
                updateData[k] = v;
            }
        } else if (apiSecret && apiSecret.trim() !== '') {
            updateData.apiSecret = encryptSecretKey(apiSecret.trim(), `${userId}-${exchangeId}`);
        }

        const updatedExchange = await ExchangeKey.findOneAndUpdate(
            { _id: id, userId },
            { $set: updateData },
            { new: true }
        );

        if (!updatedExchange) {
            return NextResponse.json({ success: false, reason: 'Exchange not found' }, { status: 404 });
        }

        const responseData = updatedExchange.toObject();
        for (const f of SECRET_FIELDS) delete responseData[f];

        return NextResponse.json({ success: true, exchange: responseData });
    } catch (e: any) {
        return NextResponse.json({ success: false, reason: e.message }, { status: 500 });
    }
});
