import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
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

  const entries: { role: string; text: string }[] = session[0].transcript
    ? JSON.parse(session[0].transcript)
    : [];

  const date = (session[0].startedAt ?? new Date()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const mins = Math.round((session[0].durationSecs ?? 0) / 60);

  const lines: string[] = [
    'TutorTalk — Conversation Transcript',
    `Subject : ${session[0].subject}`,
    `Date    : ${date}`,
    `Duration: ${mins < 1 ? '< 1' : mins} min`,
    '',
    '─'.repeat(60),
    '',
    ...entries.flatMap(e => [
      e.role === 'ai' ? 'TutorTalk' : 'You',
      e.text,
      '',
    ]),
  ];

  const text = lines.join('\n');
  const safeName = (session[0].subject ?? 'session')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="tutortalk-${safeName}.txt"`,
    },
  });
}
