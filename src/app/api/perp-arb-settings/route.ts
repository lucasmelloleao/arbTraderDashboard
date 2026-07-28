import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/mongodb';
import PerpArbSettings from '@/models/PerpArbSettings';
import User from '@/models/User';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    
    // Simplification for the single-user mode or fetch admin user
    const users = await User.find({});
    if (!users.length) return NextResponse.json({ error: 'No user found' }, { status: 404 });
    const user = users[0];

    let settings = await PerpArbSettings.findOne({ userId: user._id });
    if (!settings) {
      settings = await PerpArbSettings.create({ userId: user._id });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error fetching PerpArbSettings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await connectToDatabase();

    const users = await User.find({});
    if (!users.length) return NextResponse.json({ error: 'No user found' }, { status: 404 });
    const user = users[0];

    // Remove immutable fields if present
    const updateData = { ...body };
    delete updateData._id;
    delete updateData.userId;

    const settings = await PerpArbSettings.findOneAndUpdate(
      { userId: user._id },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error updating PerpArbSettings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
