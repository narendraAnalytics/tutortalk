import { currentUser, auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import DashboardClient from './DashboardClient';
import { getPlanFromHas, PLAN_LIMITS, type PlanKey } from '@/lib/plans';

export type SessionRow = {
  id: string;
  subject: string;
  durationSecs: number;
  startedAt: string;        // ISO — dates aren't serialisable as props
  exchangeCount: number;
  preview: string;
  type: 'tutor' | 'exam';
  score?: { answered: number; total: number } | null;
};

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const { has } = await auth();
  const plan = getPlanFromHas(has as (p: { plan: string }) => boolean);

  // Lazy sync: upsert Clerk user into Neon on dashboard visit
  const email = user.emailAddresses[0]?.emailAddress ?? '';
  const name  = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
  const existing = await db.select().from(users).where(eq(users.clerkId, user.id)).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({ clerkId: user.id, email, name, plan });
  } else if (existing[0].plan !== plan) {
    await db.update(users).set({ plan }).where(eq(users.clerkId, user.id));
  }

  const dbUser = existing[0] ?? (await db.select().from(users).where(eq(users.clerkId, user.id)).limit(1))[0];

  const limits = PLAN_LIMITS[plan as PlanKey];

  // Fetch sessions ordered newest first
  const rows = await db
    .select({
      id:          sessions.id,
      subject:     sessions.subject,
      durationSecs:sessions.durationSecs,
      startedAt:   sessions.startedAt,
      transcript:  sessions.transcript,
      type:        sessions.type,
      score:       sessions.score,
    })
    .from(sessions)
    .where(eq(sessions.userId, dbUser.id))
    .orderBy(desc(sessions.startedAt));

  // Shape data for client component
  const allSessionData: SessionRow[] = rows.map(r => {
    const entries: { role: string; text: string }[] = r.transcript
      ? JSON.parse(r.transcript)
      : [];
    const firstAI = entries.find(e => e.role === 'ai')?.text ?? '';
    return {
      id:           r.id,
      subject:      r.subject,
      durationSecs: r.durationSecs ?? 0,
      startedAt:    (r.startedAt ?? new Date()).toISOString(),
      exchangeCount:entries.length,
      preview:      firstAI.length > 90 ? firstAI.slice(0, 90) + '…' : firstAI || `${r.subject} session`,
      type:         (r.type ?? 'tutor') as 'tutor' | 'exam',
      score:        r.score ? JSON.parse(r.score) : null,
    };
  });

  // Free plan: limit dashboard history to 1 session
  const sessionData = limits.dashboardHistory === Infinity
    ? allSessionData
    : allSessionData.slice(0, limits.dashboardHistory);

  // Metrics always computed from ALL sessions (not limited slice)
  const totalSessions  = allSessionData.length;
  const totalMinutes   = Math.round(allSessionData.reduce((s, r) => s + r.durationSecs, 0) / 60);
  const topicsCovered  = new Set(allSessionData.map(s => s.subject)).size;

  const firstName = user.firstName ?? email.split('@')[0] ?? 'there';

  return (
    <DashboardClient
      firstName={firstName}
      sessions={sessionData}
      totalSessions={totalSessions}
      totalMinutes={totalMinutes}
      topicsCovered={topicsCovered}
      plan={plan as PlanKey}
    />
  );
}
