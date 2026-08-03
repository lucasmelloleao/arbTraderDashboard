import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import speakeasy from 'speakeasy';

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const { twoFactorToken } = await req.json();
    if (!twoFactorToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ error: 'User or 2FA secret not found' }, { status: 404 });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: twoFactorToken,
      window: 1 // allows 1 step before or after current time
    });

    if (!verified) {
      return NextResponse.json({ error: 'Invalid 2FA token' }, { status: 400 });
    }

    user.twoFactorEnabled = true;
    await user.save();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ [2FA Verify] Error:', error);
    return NextResponse.json({ error: 'Failed to verify 2FA' }, { status: 500 });
  }
});

