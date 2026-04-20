import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  // Lazy sync: upsert Clerk user into Neon on first dashboard visit
  const email = user.emailAddresses[0]?.emailAddress ?? '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
  const existing = await db.select().from(users).where(eq(users.clerkId, user.id)).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({ clerkId: user.id, email, name });
  }

  const firstName = user.firstName ?? email.split('@')[0] ?? 'there';

  return <DashboardClient firstName={firstName} />;
}
