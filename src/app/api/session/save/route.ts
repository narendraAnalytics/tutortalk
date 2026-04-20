import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, transcript, durationSecs, startedAt } = await req.json();

  // Resolve Neon UUID from Clerk string ID
  const user = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user.length) return NextResponse.json({ error: "User not found in DB" }, { status: 404 });

  const [saved] = await db
    .insert(sessions)
    .values({
      userId: user[0].id,
      subject,
      transcript: JSON.stringify(transcript),
      durationSecs,
      startedAt: new Date(startedAt),
      endedAt: new Date(),
    })
    .returning({ id: sessions.id });

  return NextResponse.json({ sessionId: saved.id });
}
