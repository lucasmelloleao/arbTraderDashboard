import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import ExchangeKey from '@/models/ExchangeKey';
import { withAuth } from '@/lib/auth';
import { encryptSecretKey } from '@/lib/encryption';
import { CTRADER_TOKEN_URL } from '@/lib/ctrader';

export const runtime = 'nodejs';

// Troca o código de autorização da cTrader Open API por access/refresh token
// e salva criptografado no ExchangeKey da corretora cTrader/pepperstone.
export const POST = withAuth(async (req: NextRequest, userId: string) => {
    try {
        const body = await req.json();
        const { code, redirectUri, keyId } = body;
        if (!code) {
            return NextResponse.json({ success: false, reason: 'Missing authorization code' }, { status: 400 });
        }

        await connectMongo();

        const key = keyId
            ? await ExchangeKey.findOne({ _id: keyId, userId })
            : await ExchangeKey.findOne({ userId, exchangeId: { $in: ['ctrader', 'pepperstone'] }, active: true }).sort({ createdAt: -1 });

        if (!key) {
            return NextResponse.json({ success: false, reason: 'No cTrader key found. Register the clientId/clientSecret first.' }, { status: 404 });
        }

        // clientSecret está criptografado no banco (formato iv:authTag:encrypted).
        const { decryptSecretKey } = await import('@/lib/encryption');
        const aad = `${userId}-${key.exchangeId}`;
        let clientSecret = key.clientSecret || key.apiSecret || '';
        try {
            clientSecret = decryptSecretKey(clientSecret, aad);
        } catch { /* já está em texto plano */ }

        const tokenUrl = new URL(CTRADER_TOKEN_URL);
        tokenUrl.searchParams.set('grant_type', 'authorization_code');
        tokenUrl.searchParams.set('code', code);
        tokenUrl.searchParams.set('redirect_uri', redirectUri || (process.env.CTRADER_REDIRECT_URI || 'https://arb-trader-dashboard.vercel.app/'));
        tokenUrl.searchParams.set('client_id', key.clientId || key.apiKey || '');
        tokenUrl.searchParams.set('client_secret', clientSecret);

        const res = await fetch(tokenUrl.toString(), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        const data = await res.json();

        if (!res.ok || data?.errorCode || !data?.accessToken) {
            return NextResponse.json({ success: false, reason: data?.description || data?.errorCode || 'Failed to exchange code' }, { status: 400 });
        }

        // Persiste os tokens criptografados
        const update: any = {
            accessToken: encryptSecretKey(data.accessToken, aad),
            refreshToken: encryptSecretKey(data.refreshToken || '', aad),
            ctraderTokenUpdatedAt: new Date(),
        };
        await ExchangeKey.updateOne({ _id: key._id }, { $set: update });

        return NextResponse.json({ success: true, accountId: data.accountId || key.accountId || null });
    } catch (e: any) {
        return NextResponse.json({ success: false, reason: e.message }, { status: 500 });
    }
});
