import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import React from 'react';
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFBF7',
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D85A30',
    marginRight: 8,
  },
  appName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#D85A30',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#4A1B0C',
    marginBottom: 14,
    marginTop: 4,
  },

  // ── Meta pill row ──
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  metaPill: {
    backgroundColor: '#FFF3EC',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  metaLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#993C1D',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 11,
    color: '#4A1B0C',
    fontFamily: 'Helvetica-Bold',
    marginTop: 1,
  },

  // ── Divider ──
  divider: {
    height: 1.5,
    backgroundColor: '#F2E4DB',
    marginBottom: 18,
    borderRadius: 1,
  },

  // ── Section label ──
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#C4A99A',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 16,
  },

  // ── Bubbles ──
  bubbleWrap: {
    marginBottom: 10,
  },
  aiWrap: {
    alignItems: 'flex-start',
  },
  userWrap: {
    alignItems: 'flex-end',
  },
  aiBubble: {
    backgroundColor: '#FFF3EC',
    borderRadius: 14,
    borderBottomLeftRadius: 3,
    paddingVertical: 9,
    paddingHorizontal: 13,
    maxWidth: '78%',
    borderLeftWidth: 3,
    borderLeftColor: '#D85A30',
  },
  userBubble: {
    backgroundColor: '#EEEDFE',
    borderRadius: 14,
    borderBottomRightRadius: 3,
    paddingVertical: 9,
    paddingHorizontal: 13,
    maxWidth: '78%',
    borderRightWidth: 3,
    borderRightColor: '#7F77DD',
  },
  aiLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#D85A30',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  userLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#7F77DD',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  aiText: {
    fontSize: 11,
    color: '#4A1B0C',
    lineHeight: 1.6,
  },
  userText: {
    fontSize: 11,
    color: '#26215C',
    lineHeight: 1.6,
  },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#C4A99A',
  },
  footerBrand: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#D85A30',
  },
});

function TranscriptPDF({
  entries,
  subject,
  date,
  mins,
}: {
  entries: { role: string; text: string }[];
  subject: string;
  date: string;
  mins: string;
}) {
  return React.createElement(
    Document,
    { title: `TutorTalk — ${subject}` },
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },

      // Header
      React.createElement(
        View,
        { style: styles.headerRow },
        React.createElement(View, { style: styles.dot }),
        React.createElement(Text, { style: styles.appName }, 'TUTORTALK'),
      ),
      React.createElement(Text, { style: styles.title }, 'Conversation Transcript'),

      // Meta pills
      React.createElement(
        View,
        { style: styles.metaRow },
        ...[
          { label: 'Subject', value: subject },
          { label: 'Date', value: date },
          { label: 'Duration', value: mins },
        ].map(({ label, value }) =>
          React.createElement(
            View,
            { style: styles.metaPill, key: label },
            React.createElement(Text, { style: styles.metaLabel }, label),
            React.createElement(Text, { style: styles.metaValue }, value),
          ),
        ),
      ),

      // Divider + label
      React.createElement(View, { style: styles.divider }),
      React.createElement(Text, { style: styles.sectionLabel }, 'Conversation'),

      // Messages
      ...entries.map((e, i) =>
        React.createElement(
          View,
          { style: [styles.bubbleWrap, e.role === 'ai' ? styles.aiWrap : styles.userWrap], key: i },
          React.createElement(
            View,
            { style: e.role === 'ai' ? styles.aiBubble : styles.userBubble },
            React.createElement(
              Text,
              { style: e.role === 'ai' ? styles.aiLabel : styles.userLabel },
              e.role === 'ai' ? 'TutorTalk' : 'You',
            ),
            React.createElement(Text, { style: e.role === 'ai' ? styles.aiText : styles.userText }, e.text),
          ),
        ),
      ),

      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(Text, { style: styles.footerBrand }, 'TutorTalk'),
        React.createElement(
          Text,
          { style: styles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` },
        ),
      ),
    ),
  );
}

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
  const minsLabel = mins < 1 ? '< 1 min' : `${mins} min`;

  const safeName = (session[0].subject ?? 'session')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const pdfElement = React.createElement(TranscriptPDF, {
    entries,
    subject: session[0].subject ?? 'Session',
    date,
    mins: minsLabel,
  });

  const buffer = await renderToBuffer(pdfElement as any);

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tutortalk-${safeName}.pdf"`,
    },
  });
}
