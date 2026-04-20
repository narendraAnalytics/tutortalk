import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, name } = await req.json();

  const existing = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);

  if (existing.length === 0) {
    await db.insert(users).values({ clerkId: userId, email: email ?? "", name: name ?? null });
  } else if (existing[0].email !== email || existing[0].name !== name) {
    await db.update(users).set({ email, name }).where(eq(users.clerkId, userId));
  }

  return NextResponse.json({ synced: true });
}
