import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import PerpArbSettings from '@/models/PerpArbSettings';
import { withAuth } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();

    let settings = await PerpArbSettings.findOne({ userId });
    if (!settings) {
      settings = await PerpArbSettings.create({ userId });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error fetching PerpArbSettings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const body = await req.json();
    await connectToDatabase();

    // Remove immutable fields if present
    const updateData = { ...body };
    delete updateData._id;
    delete updateData.userId;

    const settings = await PerpArbSettings.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Error updating PerpArbSettings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

