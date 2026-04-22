import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, and, gte, count } from 'drizzle-orm';
import { getPlanFromHas, PLAN_LIMITS, type PlanKey } from '@/lib/plans';

export async function GET() {
  const { userId, has } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const plan = getPlanFromHas(has as (p: { plan: string }) => boolean);
  const limits = PLAN_LIMITS[plan as PlanKey];

  if (limits.examsPerMonth === Infinity) {
    return NextResponse.json({ examsLeft: null, limitReached: false });
  }

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [{ examCount }] = await db
    .select({ examCount: count() })
    .from(sessions)
    .where(and(
      eq(sessions.userId, dbUser.id),
      eq(sessions.type, 'exam'),
      gte(sessions.startedAt, monthStart),
    ));

  const examsLeft = Math.max(0, limits.examsPerMonth - examCount);
  return NextResponse.json({ examsLeft, limitReached: examsLeft === 0 });
}
