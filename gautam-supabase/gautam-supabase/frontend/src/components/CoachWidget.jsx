import React, { useState, useRef, useEffect } from "react";
import { aiApi } from "@/lib/api";
import { Sparkles, X, Send, Brain } from "lucide-react";

const QUICK_PROMPTS = [
  "Where is my biggest leak?",
  "What time of day am I most profitable?",
  "Which strategy has the best win rate?",
  "How does my mood impact my P&L?",
  "What should I focus on next week?",
];

export default function CoachWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role: 'user'|'coach', text}
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, asking, open]);

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (!text || asking) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setQuestion("");
    setAsking(true);
    try {
      const history = messages.map((m) => ({ role: m.role === "user" ? "user" : "coach", text: m.text }));
      const r = await aiApi.psychology({ question: text, history });
      setMessages((m) => [...m, { role: "coach", text: r?.insight || "I couldn't find an answer for that." }]);
    } catch {
      setMessages((m) => [...m, { role: "coach", text: "Sorry, I couldn't reach the AI coach right now. Try again in a bit." }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Ask Your Coach"
        data-testid="coach-widget-fab"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] shadow-[0_10px_30px_rgba(124,58,237,0.45)] flex items-center justify-center text-white transition-transform hover:scale-105"
      >
        {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          data-testid="coach-widget-panel"
          className="fixed bottom-24 right-6 z-40 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[70vh] rounded-2xl bg-white border border-[#E8E8F1] shadow-[0_20px_60px_rgba(16,15,30,0.18)] flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[#E8E8F1] bg-gradient-to-r from-[#F3E8FF] to-white flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[13px] font-bold leading-tight">Ask Your Coach</div>
              <div className="text-[11px] text-[#6D6D82] truncate">Honest answers from your trade data</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-thin px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-[#6D6D82] leading-relaxed">
                Ask me anything about your trading — moods, strategies, timing, mistakes. I'll answer using your journal data.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[#7C3AED] text-white rounded-br-sm"
                      : "bg-[#F6F6FB] text-[#16151F] rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm bg-[#F6F6FB] text-[#6D6D82]">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {QUICK_PROMPTS.slice(0, 3).map((q) => (
                <button key={q} onClick={() => ask(q)} className="chip" style={{ fontSize: 11, padding: "4px 8px" }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="p-3 border-t border-[#E8E8F1] flex gap-2 shrink-0">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Ask your coach..."
              data-testid="coach-widget-input"
              className="flex-1 h-10 px-3 rounded-xl border border-[#E8E8F1] focus:border-[#7C3AED] outline-none text-sm"
            />
            <button
              onClick={() => ask()}
              disabled={asking || !question.trim()}
              data-testid="coach-widget-send"
              className="w-10 h-10 shrink-0 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center justify-center disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
