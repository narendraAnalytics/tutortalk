import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { getPlanFromHas, PLAN_LIMITS, type PlanKey } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const { userId, has } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, transcript, durationSecs, startedAt, type, score } = await req.json();

  const plan = getPlanFromHas(has as (p: { plan: string }) => boolean);
  const limits = PLAN_LIMITS[plan as PlanKey];

  // Resolve Neon UUID from Clerk string ID and sync plan
  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!dbUser) return NextResponse.json({ error: "User not found in DB" }, { status: 404 });

  // Sync plan to DB if changed
  if (dbUser.plan !== plan) {
    await db.update(users).set({ plan }).where(eq(users.clerkId, userId));
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Enforce monthly tutor session limit
  if ((type ?? 'tutor') === 'tutor' && limits.sessionsPerMonth !== Infinity) {
    const [{ sessionCount }] = await db
      .select({ sessionCount: count() })
      .from(sessions)
      .where(and(
        eq(sessions.userId, dbUser.id),
        eq(sessions.type, 'tutor'),
        gte(sessions.startedAt, monthStart),
      ));
    if (sessionCount >= limits.sessionsPerMonth) {
      return NextResponse.json({ error: 'SESSION_LIMIT_REACHED' }, { status: 403 });
    }
  }

  // Enforce monthly exam limit
  if (type === 'exam' && limits.examsPerMonth !== Infinity) {
    const [{ examCount }] = await db
      .select({ examCount: count() })
      .from(sessions)
      .where(and(
        eq(sessions.userId, dbUser.id),
        eq(sessions.type, 'exam'),
        gte(sessions.startedAt, monthStart),
      ));
    if (examCount >= limits.examsPerMonth) {
      return NextResponse.json({ error: 'EXAM_LIMIT_REACHED' }, { status: 403 });
    }
  }

  const [saved] = await db
    .insert(sessions)
    .values({
      userId: dbUser.id,
      subject,
      transcript: JSON.stringify(transcript),
      durationSecs,
      startedAt: new Date(startedAt),
      endedAt: new Date(),
      type: type ?? 'tutor',
      score: score ?? null,
    })
    .returning({ id: sessions.id });

  return NextResponse.json({ sessionId: saved.id });
}
