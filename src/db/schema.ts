import { pgTable, uuid, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Clerk IDs are strings like "user_xxxxxxx", not UUIDs
  clerkId: varchar("clerk_id", { length: 255 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  subject: varchar("subject", { length: 255 }).notNull(),
  transcript: text("transcript"),
  durationSecs: integer("duration_secs"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  type: varchar("type", { length: 20 }).default('tutor'),
  score: text("score"),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id),
  pdfUrl: text("pdf_url").notNull(),
  pdfData: text("pdf_data"),
  summary: text("summary"),
  generatedAt: timestamp("generated_at").defaultNow(),
});
