"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon, CheckIcon, MicIcon, PlusIcon, StopIcon, ThinkIcon, WaveIcon, XIcon } from "./icons";

const CURRICULA = [
  { id: "UNEB", label: "UNEB", hint: "P1 – S6 · UCE / UACE" },
  { id: "Cambridge", label: "Cambridge", hint: "Primary – A Level" },
  { id: "IB", label: "IB Diploma", hint: "HL / SL · TOK · EE" },
];

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  think,
  onToggleThink,
  curriculum,
  onCurriculum,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  think: boolean;
  onToggleThink: () => void;
  curriculum: string | null;
  onCurriculum: (c: string | null) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus, value === ""]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    baseRef.current = value ? value.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      onChange(baseRef.current + t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const hasText = value.trim().length > 0;
  const multiline = value.includes("\n") || value.length > 70;

  return (
    <div className="relative">
      <div
        className={`flex w-full flex-wrap items-end gap-1 border border-neutral-800 bg-[#212121] px-2.5 py-2 shadow-lg shadow-black/40 ${
          multiline ? "rounded-3xl" : "rounded-[28px]"
        }`}
      >
        <button
          onClick={() => setMenu((m) => !m)}
          title="Curriculum"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-200 hover:bg-neutral-700/60"
        >
          <PlusIcon width={20} height={20} />
        </button>

        {curriculum && (
          <span className="mb-1.5 flex shrink-0 items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-300">
            {curriculum}
            <button onClick={() => onCurriculum(null)} className="hover:text-white">
              <XIcon width={12} height={12} />
            </button>
          </span>
        )}

        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!streaming) onSend();
            }
          }}
          placeholder={listening ? "Listening…" : placeholder}
          className="scroll-thin max-h-[220px] min-w-[120px] flex-1 resize-none bg-transparent px-1.5 py-[7px] text-[16px] text-white placeholder-neutral-400 outline-none"
        />

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onToggleThink}
            title="Think longer"
            className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[15px] transition ${
              think ? "bg-blue-500/15 text-blue-300" : "text-neutral-300 hover:bg-neutral-700/60"
            }`}
          >
            <ThinkIcon width={18} height={18} />
            <span className="hidden sm:inline">Think</span>
          </button>
          <button
            onClick={toggleMic}
            title="Dictate"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
              listening ? "bg-red-500/20 text-red-400" : "text-neutral-300 hover:bg-neutral-700/60"
            }`}
          >
            <MicIcon width={18} height={18} />
          </button>
          {streaming ? (
            <button
              onClick={onStop}
              title="Stop"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black"
            >
              <StopIcon width={16} height={16} />
            </button>
          ) : hasText ? (
            <button
              onClick={onSend}
              title="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200"
            >
              <ArrowUpIcon width={18} height={18} />
            </button>
          ) : (
            <button
              onClick={toggleMic}
              title="Voice"
              className={`flex h-9 w-9 items-center justify-center rounded-full text-white transition ${
                listening ? "bg-red-500" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              <WaveIcon width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
          <div className="absolute bottom-full left-0 z-40 mb-2 w-64 rounded-2xl border border-neutral-800 bg-[#2a2a2a] p-1.5 shadow-xl">
            <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              My curriculum
            </div>
            {CURRICULA.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onCurriculum(curriculum === c.id ? null : c.id);
                  setMenu(false);
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-neutral-700/60"
              >
                <span>
                  <span className="block text-sm text-white">{c.label}</span>
                  <span className="block text-xs text-neutral-400">{c.hint}</span>
                </span>
                {curriculum === c.id && <CheckIcon width={16} height={16} className="text-blue-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
