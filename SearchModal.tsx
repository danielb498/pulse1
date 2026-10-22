"use client";

import { useEffect, useState } from "react";
import { ChatIcon, EditIcon, SearchIcon, XIcon } from "./icons";

type Conv = { id: string; title: string; updatedAt: string };

export default function SearchModal({
  onClose,
  onOpen,
  onNew,
}: {
  onClose: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/conversations${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`, {
          signal: ctrl.signal,
        });
        if (res.ok) setResults(await res.json());
      } catch {}
      setLoading(false);
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-800 bg-[#171717]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <SearchIcon width={18} height={18} className="text-neutral-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats…"
            className="flex-1 bg-transparent text-[15px] text-white placeholder-neutral-500 outline-none"
          />
          <button onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-800">
            <XIcon width={18} height={18} />
          </button>
        </div>
        <div className="scroll-thin max-h-[50vh] overflow-y-auto p-2">
          <button
            onClick={onNew}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-200 hover:bg-neutral-800"
          >
            <EditIcon width={16} height={16} /> New chat
          </button>
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-200 hover:bg-neutral-800"
            >
              <ChatIcon width={16} height={16} className="shrink-0 text-neutral-500" />
              <span className="truncate">{c.title}</span>
              <span className="ml-auto shrink-0 text-xs text-neutral-500">
                {new Date(c.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
          {!loading && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">No chats found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
