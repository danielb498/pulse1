"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import Composer from "./Composer";
import SearchModal from "./SearchModal";
import {
  BookIcon,
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  CopyIcon,
  EditIcon,
  LibraryIcon,
  PencilIcon,
  PulseLogo,
  SearchIcon,
  SparkIcon,
  TrashIcon,
  XIcon,
} from "./icons";

type Msg = { id: string; role: "user" | "assistant"; content: string };
type Conv = { id: string; title: string; mode: string; updatedAt: string };

const SUGGESTIONS = [
  { key: "explain", icon: BookIcon, label: "Explain a topic", prefix: "Explain this topic simply: " },
  { key: "write", icon: PencilIcon, label: "Write or edit", prefix: "Help me write or edit: " },
  { key: "plan", icon: CalendarIcon, label: "Make a revision plan", prefix: "Make me a revision plan for " },
];

const LIBRARY = [
  { title: "UNEB · UCE Biology", prompt: "Give me 5 UCE-style Biology questions on photosynthesis with a marking guide." },
  { title: "UNEB · UACE Maths", prompt: "Explain integration by parts with a UACE Paper 1 style worked example." },
  { title: "Cambridge · IGCSE Physics 0625", prompt: "Summarise the key formulas for IGCSE Physics 0625 (Extended) electricity." },
  { title: "Cambridge · A Level Chemistry", prompt: "Explain SN1 vs SN2 mechanisms for A Level Chemistry with examples." },
  { title: "IB · Math AA HL", prompt: "Give me an IB Math AA HL proof by induction question and walk me through it." },
  { title: "IB · TOK essay", prompt: "Help me brainstorm a TOK essay outline on the current prescribed titles." },
  { title: "IB · Extended Essay", prompt: "How should I structure a 4,000-word IB Extended Essay in History?" },
  { title: "UNEB · UACE points", prompt: "How are UACE points calculated? Show an example for PCM." },
];

export default function ChatApp({ initialId }: { initialId: string | null }) {
  const [conversationId, setConversationId] = useState<string | null>(initialId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"chat" | "study">("chat");
  const [think, setThink] = useState(false);
  const [curriculum, setCurriculum] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loadingConv, setLoadingConv] = useState(Boolean(initialId));
  const [history, setHistory] = useState<Conv[]>([]);
  const [sidebar, setSidebar] = useState(false);
  const [panel, setPanel] = useState<null | "search" | "library">(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) setHistory(await res.json());
  }, []);

  useEffect(() => {
    loadHistory();
    try {
      setHidden(JSON.parse(localStorage.getItem("pulse.hidden") || "[]"));
      const c = localStorage.getItem("pulse.curriculum");
      if (c) setCurriculum(c);
      if (window.innerWidth >= 1024 && localStorage.getItem("pulse.sidebar") === "1") setSidebar(true);
    } catch {}
  }, [loadHistory]);

  useEffect(() => {
    try {
      if (curriculum) localStorage.setItem("pulse.curriculum", curriculum);
      else localStorage.removeItem("pulse.curriculum");
    } catch {}
  }, [curriculum]);

  const openConversation = useCallback(async (id: string, push = true) => {
    abortRef.current?.abort();
    setLoadingConv(true);
    setConversationId(id);
    if (push) window.history.pushState(null, "", `/c/${id}`);
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
      setMode(data.conversation.mode === "study" ? "study" : "chat");
    } else {
      setMessages([]);
      setConversationId(null);
      window.history.replaceState(null, "", "/");
    }
    stickRef.current = true;
    setLoadingConv(false);
    if (window.innerWidth < 1024) setSidebar(false);
  }, []);

  useEffect(() => {
    if (initialId) openConversation(initialId, false);
  }, [initialId, openConversation]);

  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/^\/c\/([^/]+)/);
      if (m) openConversation(m[1], false);
      else {
        setConversationId(null);
        setMessages([]);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [openConversation]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const newChat = () => {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setInput("");
    window.history.pushState(null, "", "/");
    if (window.innerWidth < 1024) setSidebar(false);
  };

  const send = async (textArg?: string) => {
    const text = (textArg ?? input).trim();
    if (!text || streaming) return;
    setInput("");
    stickRef.current = true;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    const botId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: botId, role: "assistant", content: "" }]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text, mode, think, curriculum }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
      const newId = res.headers.get("X-Conversation-Id");
      if (newId && newId !== conversationId) {
        setConversationId(newId);
        window.history.replaceState(null, "", `/c/${newId}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, content: snapshot } : x)));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((m) =>
          m.map((x) =>
            x.id === botId ? { ...x, content: x.content + `\n\n⚠️ ${(err as Error).message}` } : x,
          ),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      loadHistory();
    }
  };

  const stop = () => abortRef.current?.abort();

  const deleteConv = async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (id === conversationId) newChat();
    loadHistory();
  };

  const hideSuggestion = (key: string) => {
    const next = [...hidden, key];
    setHidden(next);
    try {
      localStorage.setItem("pulse.hidden", JSON.stringify(next));
    } catch {}
  };

  const toggleSidebar = () => {
    setSidebar((s) => {
      try {
        localStorage.setItem("pulse.sidebar", s ? "0" : "1");
      } catch {}
      return !s;
    });
  };

  const empty = messages.length === 0 && !loadingConv;
  const composerProps = {
    value: input,
    onChange: setInput,
    onSend: () => send(),
    onStop: stop,
    streaming,
    think,
    onToggleThink: () => setThink((t) => !t),
    curriculum,
    onCurriculum: setCurriculum,
    placeholder: mode === "study" ? "What do you want to learn?" : "Ask Pulse",
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-black">
      {/* Icon rail */}
      <aside className="z-30 flex w-[52px] shrink-0 flex-col items-center border-r border-neutral-900 py-3">
        <button
          onClick={newChat}
          title="Pulse"
          className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-neutral-800"
        >
          <PulseLogo width={22} height={22} />
        </button>
        <RailButton title="New chat" onClick={newChat} active={empty && panel === null}>
          <EditIcon width={18} height={18} />
        </RailButton>
        <RailButton title="Search chats" onClick={() => setPanel("search")} active={panel === "search"}>
          <SearchIcon width={18} height={18} />
        </RailButton>
        <RailButton title="Chats" onClick={toggleSidebar} active={sidebar}>
          <ChatIcon width={18} height={18} />
        </RailButton>
        <RailButton title="Study library" onClick={() => setPanel("library")} active={panel === "library"}>
          <LibraryIcon width={18} height={18} />
        </RailButton>
        <div className="mt-auto">
          <div
            title="Student"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white"
          >
            ST
          </div>
        </div>
      </aside>

      {/* History panel */}
      {sidebar && (
        <>
          <div className="fixed inset-0 z-10 bg-black/60 lg:hidden" onClick={() => setSidebar(false)} />
          <nav className="fixed left-[52px] top-0 z-20 flex h-full w-64 flex-col border-r border-neutral-900 bg-[#0d0d0d] lg:static">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <span className="text-sm font-medium text-neutral-300">Chats</span>
              <button
                onClick={() => setSidebar(false)}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
              >
                <XIcon width={16} height={16} />
              </button>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-4">
              {history.length === 0 && (
                <p className="px-2 py-6 text-sm text-neutral-500">No chats yet. Start one!</p>
              )}
              {history.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center rounded-lg ${
                    c.id === conversationId ? "bg-neutral-800" : "hover:bg-neutral-900"
                  }`}
                >
                  <button
                    onClick={() => openConversation(c.id)}
                    className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-neutral-200"
                  >
                    {c.mode === "study" && <SparkIcon width={10} height={10} className="mr-1.5 inline text-blue-400" />}
                    {c.title}
                  </button>
                  <button
                    onClick={() => deleteConv(c.id)}
                    title="Delete"
                    className="mr-1 hidden rounded-md p-1.5 text-neutral-500 hover:text-red-400 group-hover:block"
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
          </nav>
        </>
      )}

      {/* Main */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-center px-4">
          <div className="flex rounded-full bg-[#1a1a1a] p-1 text-sm">
            <button
              onClick={() => setMode("chat")}
              className={`rounded-full px-6 py-1.5 font-semibold transition ${
                mode === "chat" ? "bg-[#2f2f2f] text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setMode("study")}
              className={`flex items-center gap-1 rounded-full px-5 py-1.5 font-semibold transition ${
                mode === "study" ? "bg-[#2f2f2f] text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <SparkIcon width={11} height={11} /> Study
            </button>
          </div>
          <div className="absolute right-4 top-3 flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-sm font-medium text-blue-400 sm:flex">
              <PulseLogo width={16} height={16} /> Beta
            </span>
            <button
              onClick={newChat}
              title="New chat"
              className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
            >
              <EditIcon width={18} height={18} />
            </button>
          </div>
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
            <h1 className="mb-7 text-center text-2xl font-normal text-white sm:text-[28px]">
              {mode === "study" ? "What are we studying today?" : "What’s on the agenda today?"}
            </h1>
            <div className="w-full max-w-3xl">
              <Composer {...composerProps} autoFocus />
              <div className="mt-6 space-y-0.5">
                {SUGGESTIONS.filter((s) => !hidden.includes(s.key)).map((s) => (
                  <div
                    key={s.key}
                    className="group flex items-center rounded-2xl px-4 py-3.5 text-[15px] text-neutral-300 hover:bg-[#1f1f1f]"
                  >
                    <button
                      onClick={() => setInput(s.prefix)}
                      className="flex flex-1 items-center gap-4 text-left group-hover:text-white"
                    >
                      <s.icon width={17} height={17} className="text-neutral-500" />
                      {s.label}
                    </button>
                    <button
                      onClick={() => hideSuggestion(s.key)}
                      title="Hide"
                      className="invisible rounded p-0.5 text-neutral-400 hover:text-white group-hover:visible"
                    >
                      <XIcon width={16} height={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              className="scroll-thin flex-1 overflow-y-auto"
            >
              <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-10 pt-4">
                {loadingConv && <p className="text-center text-sm text-neutral-500">Loading…</p>}
                {messages.map((m, i) => (
                  <MessageRow
                    key={m.id}
                    msg={m}
                    pending={streaming && i === messages.length - 1 && m.role === "assistant"}
                  />
                ))}
              </div>
            </div>
            <div className="mx-auto w-full max-w-3xl px-4 pb-3">
              <Composer {...composerProps} autoFocus />
              <p className="mt-2 text-center text-xs text-neutral-500">
                Pulse can make mistakes. Check important info with your teacher or exam board.
              </p>
            </div>
          </>
        )}
      </main>

      {panel === "search" && (
        <SearchModal
          onClose={() => setPanel(null)}
          onOpen={(id) => {
            setPanel(null);
            openConversation(id);
          }}
          onNew={() => {
            setPanel(null);
            newChat();
          }}
        />
      )}

      {panel === "library" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[10vh]" onClick={() => setPanel(null)}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-[#171717] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium">Study library</h2>
              <button onClick={() => setPanel(null)} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-800">
                <XIcon width={18} height={18} />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {LIBRARY.map((l) => (
                <button
                  key={l.title}
                  onClick={() => {
                    setPanel(null);
                    if (conversationId) newChat();
                    setMode("study");
                    setInput(l.prompt);
                  }}
                  className="rounded-xl border border-neutral-800 p-3 text-left hover:border-neutral-600 hover:bg-neutral-900"
                >
                  <div className="text-sm font-medium text-white">{l.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-neutral-400">{l.prompt}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RailButton({
  children,
  title,
  onClick,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`mb-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-neutral-800 hover:text-white ${
        active ? "bg-neutral-800 text-white" : ""
      }`}
    >
      {children}
    </button>
  );
}

function MessageRow({ msg, pending }: { msg: Msg; pending: boolean }) {
  const [copied, setCopied] = useState(false);
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-[#2f2f2f] px-5 py-2.5 text-[15.5px] text-white">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="group">
      {msg.content ? (
        <Markdown content={msg.content} />
      ) : (
        <div className="flex gap-1 py-2">
          <span className="dot h-2 w-2 rounded-full bg-neutral-400" />
          <span className="dot h-2 w-2 rounded-full bg-neutral-400" />
          <span className="dot h-2 w-2 rounded-full bg-neutral-400" />
        </div>
      )}
      {!pending && msg.content && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(msg.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          title="Copy"
          className="mt-2 rounded-md p-1.5 text-neutral-500 opacity-0 transition hover:bg-neutral-800 hover:text-white group-hover:opacity-100"
        >
          {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
        </button>
      )}
    </div>
  );
}
