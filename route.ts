import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { makeTitle, streamCompletion, systemPrompt, type ChatMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    conversationId?: string | null;
    message?: string;
    mode?: string;
    think?: boolean;
    curriculum?: string | null;
  } | null;

  const text = body?.message?.trim();
  if (!text) return Response.json({ error: "Message is required" }, { status: 400 });
  const mode = body?.mode === "study" ? "study" : "chat";
  const think = Boolean(body?.think);

  let conversationId = body?.conversationId ?? null;
  if (conversationId) {
    const existing = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (existing.length === 0) conversationId = null;
  }
  if (!conversationId) {
    const [created] = await db
      .insert(conversations)
      .values({ title: makeTitle(text), mode })
      .returning({ id: conversations.id });
    conversationId = created.id;
  }

  await db.insert(messages).values({ conversationId, role: "user", content: text });

  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const prompt: ChatMessage[] = [
    { role: "system", content: systemPrompt(mode, think, body?.curriculum) },
    ...history.slice(-30).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as ChatMessage["role"],
      content: m.content,
    })),
  ];

  const convId = conversationId;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of streamCompletion(prompt, think, req.signal)) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        if (!req.signal.aborted) {
          const msg = `\n\n⚠️ Something went wrong: ${(err as Error).message}`;
          full += msg;
          try {
            controller.enqueue(encoder.encode(msg));
          } catch {}
        }
      } finally {
        if (full.trim()) {
          await db.insert(messages).values({ conversationId: convId, role: "assistant", content: full });
        }
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, convId));
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Conversation-Id": convId,
    },
  });
}
