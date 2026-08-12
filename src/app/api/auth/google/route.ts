import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import { sendLoginNotificationEmail } from '@/lib/emailNotifications';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { credential } = await request.json();

    if (!credential) {
      return NextResponse.json({ error: 'Missing Google credential' }, { status: 400 });
    }

    // Decodifica o payload do Google JWT decrescendo a necessidade da biblioteca google-auth-library
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid Google credential token' }, { status: 400 });
    }

    const payloadBuffer = Buffer.from(parts[1], 'base64');
    const payload = JSON.parse(payloadBuffer.toString('utf-8'));

    // Verifica expiração básica localmente para segurança
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return NextResponse.json({ error: 'Google credential expired' }, { status: 400 });
    }

    const email = payload.email;
    const name = payload.name || payload.given_name || 'Google User';

    if (!email) {
      return NextResponse.json({ error: 'Google credential has no email' }, { status: 400 });
    }

    let user = await User.findOne({ email });

    if (!user) {
      // Cria usuário com senha vazia ou gerada aleatoriamente
      user = await User.create({
        name,
        email,
        password: 'google-oauth-placeholder-password-' + Math.random().toString(36).substring(2),
      });
    }

    const token = signToken(user._id.toString());

    // Dispara notificação por e-mail sem travar o response
    sendLoginNotificationEmail(user.email, user.name);

    return NextResponse.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error: any) {
    console.error('❌ [Google Auth] Error:', error?.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
