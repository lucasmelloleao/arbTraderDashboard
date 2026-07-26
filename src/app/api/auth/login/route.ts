import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken(user._id.toString());

    return NextResponse.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error: any) {
    console.error('❌ [Login] Error:', error?.message, error?.code, error?.stack?.split('\n')[0]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
