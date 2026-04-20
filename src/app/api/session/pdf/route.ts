import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { users, sessions, reports } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return new Response('sessionId required', { status: 400 });

  const user = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user.length) return new Response('User not found', { status: 404 });

  const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session.length) return new Response('Session not found', { status: 404 });
  if (session[0].userId !== user[0].id) return new Response('Forbidden', { status: 403 });

  const report = await db.select().from(reports).where(eq(reports.sessionId, sessionId)).limit(1);
  if (!report.length || !report[0].pdfData) return new Response('PDF not ready', { status: 404 });

  const bytes = Buffer.from(report[0].pdfData, 'base64');
  const subject = session[0].subject ?? 'session';
  const safeName = subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tutortalk-${safeName}-report.pdf"`,
    },
  });
}
