"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { TbLoader2, TbSend, TbSparkles } from "react-icons/tb";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

function AssistantAvatar() {
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
      <TbSparkles className="h-4 w-4" />
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="rounded-2xl rounded-tl-sm border border-slate-700 bg-slate-700 px-4 py-3 shadow-sm text-white">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "No response body from chat endpoint.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          if (chunk) {
            assistantContent += chunk;
            setMessages((prev) => {
              const next = [...prev];
              const last = next.length - 1;
              if (last >= 0 && next[last].role === "assistant") {
                next[last] = { ...next[last], content: assistantContent };
              } else {
                next.push({ role: "assistant", content: assistantContent });
              }
              return next;
            });
          }
        }
      }
    } catch (e: any) {
      console.error("Chat error", e);
      const msg = typeof e?.message === "string" ? e.message : "Something went wrong while talking to the assistant.";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I hit an error while generating a response. Please try again.",
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !isStreaming && input.trim().length > 0;

  return (
    <div className="flex min-h-screen w-full items-start justify-center bg-slate-900 px-4 py-8 text-white">
      <div className="flex h-[calc(100vh-4rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 shadow-md">
        {/* ── Header ───────────────────────────────────── */}
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-700 bg-slate-800 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
            <TbSparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-white">Smart Debt Coach</h1>
            <p className="text-xs leading-tight text-slate-400">Answers tailored to your ClearDebt plan</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Online
          </div>
        </header>

        {/* ── Messages ─────────────────────────────────── */}
        <main className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 && !isStreaming && (
            <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
                <TbSparkles className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-100">How can I help today?</p>
              <p className="text-xs leading-relaxed text-slate-400">
                Ask about your payoff timeline, budget, or upcoming events. Try{" "}
                <button
                  className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
                  onClick={() => setInput("How much extra can I put toward debt this month without missing anything important?")}
                >
                  "How much extra can I put toward debt this month?"
                </button>
              </p>
            </div>
          )}

          {messages.map((m, idx) =>
            m.role === "user" ?
              <div key={idx} className="flex justify-end">
                <p className="max-w-[75%] rounded-2xl rounded-br-sm bg-emerald-500 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">{m.content}</p>
              </div>
            : <div key={idx} className="flex items-start gap-3">
                <AssistantAvatar />
                <p className="max-w-[75%] rounded-2xl rounded-tl-sm border border-slate-700 bg-slate-700 px-4 py-2.5 text-sm leading-relaxed text-slate-100 shadow-sm">
                  {m.content || <span className="text-slate-400">…</span>}
                </p>
              </div>,
          )}

          {/* Show thinking dots only before first token arrives */}
          {isStreaming && messages[messages.length - 1]?.content === "" && <ThinkingBubble />}

          <div ref={bottomRef} />
        </main>

        {/* ── Footer ───────────────────────────────────── */}
        <footer className="shrink-0 border-t border-slate-700 bg-slate-800 px-4 py-3">
          {error && <div className="mb-2.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}
          <div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 transition-shadow focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your payoff timeline, budget, or an upcoming event…"
              className="max-h-[140px] min-h-[24px] flex-1 resize-none bg-transparent py-0.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none disabled:text-slate-500"
              aria-label="Send message"
            >
              {isStreaming ?
                <TbLoader2 className="h-4 w-4 animate-spin" />
              : <TbSend className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-500">
            Press <kbd className="rounded bg-slate-700 px-1 py-0.5 font-mono text-[10px] text-slate-400">Enter</kbd> to send &nbsp;·&nbsp;{" "}
            <kbd className="rounded bg-slate-700 px-1 py-0.5 font-mono text-[10px] text-slate-400">Shift+Enter</kbd> for new line
          </p>
        </footer>
      </div>
    </div>
  );
}
