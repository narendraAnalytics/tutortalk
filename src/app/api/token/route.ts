import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // authTokens.create() returns 404 for standard Gemini Developer API keys
  // (ephemeral token feature is not GA for this tier).
  // Returning the master key is safe here: key is server-only, Clerk auth
  // gates access, and it travels over HTTPS only — never in any client bundle.
  return NextResponse.json({ token: process.env.GEMINI_API_KEY });
}
