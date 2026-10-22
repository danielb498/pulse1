export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const BASE_PROMPT =
  "You are Pulse, a friendly, concise AI study companion for students in Uganda and international schools. " +
  "You know the UNEB curriculum (P1–S6, old and new competency-based), Cambridge (Primary to A Level, Core/Extended tiers) and the IB Diploma (HL/SL, TOK, EE, CAS). " +
  "Answer clearly with Markdown when helpful (headings, lists, tables, code). Keep answers focused.";

const STUDY_PROMPT =
  " You are in STUDY mode: act as a patient tutor. Explain step by step, check understanding, " +
  "offer a short practice question at the end, and reference the relevant curriculum/paper when you can.";

const THINK_PROMPT =
  " Think carefully and reason through the problem step by step before giving your final answer. Show key working.";

export const CURRICULA = ["UNEB", "Cambridge", "IB"] as const;

export function systemPrompt(mode: string, think: boolean, curriculum?: string | null) {
  const cur =
    curriculum && (CURRICULA as readonly string[]).includes(curriculum)
      ? ` The student follows the ${curriculum} curriculum — tailor terminology, grading and examples to it.`
      : "";
  return BASE_PROMPT + cur + (mode === "study" ? STUDY_PROMPT : "") + (think ? THINK_PROMPT : "");
}

export function hasAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Returns an async iterable of text chunks. */
export async function* streamCompletion(
  messages: ChatMessage[],
  think: boolean,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    yield* demoStream(messages[messages.length - 1]?.content ?? "");
    return;
  }
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model =
    (think && process.env.OPENAI_THINK_MODEL) || process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    yield `⚠️ The AI provider returned an error (${res.status}). ${text.slice(0, 300)}`;
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const delta: string | undefined = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore partial lines
      }
    }
  }
}

async function* demoStream(prompt: string): AsyncGenerator<string> {
  const reply =
    `**Demo mode** — no AI key is configured yet, so here's a placeholder reply.\n\n` +
    `You asked: _"${prompt.slice(0, 200)}"_\n\n` +
    `To enable real answers, add these environment variables:\n\n` +
    `- \`OPENAI_API_KEY\` — your key (required)\n` +
    `- \`OPENAI_BASE_URL\` — optional, any OpenAI-compatible endpoint\n` +
    `- \`OPENAI_MODEL\` — optional, defaults to \`gpt-4o-mini\`\n\n` +
    `Everything else — chats, history, search — already works. 🎓`;
  const parts = reply.split(/(\s+)/);
  for (const p of parts) {
    await new Promise((r) => setTimeout(r, 12));
    yield p;
  }
}

export function makeTitle(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? clean.slice(0, 45).trimEnd() + "…" : clean || "New chat";
}
