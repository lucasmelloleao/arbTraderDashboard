import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
import { withAuth } from '@/lib/auth';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    const snapshots = await PortfolioSnapshot.find({
      $or: [{ userId: userObjId }, { userId: String(userId) }],
    })
      .sort({ timestamp: 1 })
      .lean();

    return NextResponse.json(snapshots);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
