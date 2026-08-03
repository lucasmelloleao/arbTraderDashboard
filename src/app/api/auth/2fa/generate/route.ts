import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import speakeasy from 'speakeasy';

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const secret = speakeasy.generateSecret({
      name: `ArbTrade (${user.email})`
    });

    user.twoFactorSecret = secret.base32;
    await user.save();

    return NextResponse.json({
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url
    });
  } catch (error: any) {
    console.error('❌ [2FA Generate] Error:', error);
    return NextResponse.json({ error: 'Failed to generate 2FA' }, { status: 500 });
  }
});

