import { desc, ilike, or, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();

  if (q) {
    const pattern = `%${q}%`;
    const matchIds = db
      .selectDistinct({ id: messages.conversationId })
      .from(messages)
      .where(ilike(messages.content, pattern));
    const rows = await db
      .select()
      .from(conversations)
      .where(or(ilike(conversations.title, pattern), inArray(conversations.id, matchIds)))
      .orderBy(desc(conversations.updatedAt))
      .limit(50);
    return Response.json(rows);
  }

  const rows = await db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(100);
  return Response.json(rows);
}

export async function DELETE() {
  // Clear all chats
  await db.delete(conversations).where(or(eq(conversations.mode, "chat"), eq(conversations.mode, "study")));
  return Response.json({ ok: true });
}
