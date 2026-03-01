"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { TbLoader2, TbSend, TbSparkles } from "react-icons/tb";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

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
        body: JSON.stringify({
          message: trimmed,
          history,
        }),
      });

      if (!res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "No response body from chat endpoint.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      let assistantContent = "";

      // Seed an empty assistant message to stream into.
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
              const lastIndex = next.length - 1;
              if (lastIndex >= 0 && next[lastIndex].role === "assistant") {
                next[lastIndex] = { ...next[lastIndex], content: assistantContent };
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
      const fallback = typeof e?.message === "string" ? e.message : "Something went wrong while talking to the assistant.";
      setError(fallback);
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

  return (
    <div className="flex min-h-screen w-full justify-center bg-slate-50/60 px-4 py-8 text-slate-900">
      <div className="flex w-full max-w-3xl flex-col rounded-3xl border border-slate-100 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-black">
              <TbSparkles className="h-5 w-5 text-emerald-500" />
              Smart Debt Coach
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Ask anything about your debts, budget, or upcoming events. Answers are tailored using your ClearDebt data.
            </p>
          </div>
        </header>

        <main className="flex min-h-[420px] flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-center text-xs text-emerald-700">
              Try something like: “Given my current plan and calendar events, how much extra can I put toward debt this month without missing anything
              important?”
            </div>
          )}

          {messages.map((m, idx) => (
            <div key={idx} className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user" ? "rounded-br-sm bg-emerald-500 text-white" : "rounded-bl-sm border border-slate-100 bg-slate-50 text-slate-900"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <TbLoader2 className="h-4 w-4 animate-spin" />
              <span>Thinking with your debts, budget, and events…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </main>

        <footer className="border-t border-slate-100 px-4 py-3">
          {error && <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</div>}
          <div className="flex items-end gap-3">
            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your payoff timeline, budget, or an upcoming event…"
                className="h-16 w-full resize-none bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isStreaming ?
                <>
                  <TbLoader2 className="h-4 w-4 animate-spin" />
                  Streaming…
                </>
              : <>
                  <span>Send</span>
                  <TbSend className="h-4 w-4" />
                </>
              }
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
