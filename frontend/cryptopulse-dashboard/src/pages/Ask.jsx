import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AiOrb } from "../components/Illustrations";
import { Card } from "../components/ui";
import { api } from "../lib/api";
import { Markdown } from "../lib/markdown";
import { useAuth } from "../lib/auth";
import { load, save } from "../lib/storage";
import { usePortfolio } from "../lib/usePortfolio";
import { useApi } from "../lib/useApi";

const CHAT_KEY = "cp-chat";

const WELCOME = {
  role: "assistant",
  content:
    "Hi! I'm **CryptoPulse AI**. Ask me anything about BTC, ETH or SOL, or about **your own portfolio**. " +
    "I answer using this project's live models and data, and show you exactly which data I used.\n\n" +
    "- Why is the forecast up or down?\n- Is a coin risky right now?\n- Which model can I trust most?",
};

function ModeBadge({ status }) {
  if (!status) return null;
  const ai = status.mode === "ai";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
      ai ? "bg-violet-500/10 text-violet-300 ring-violet-400/30" : "bg-white/5 text-ink2 ring-white/10"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ai ? "live-dot bg-violet-400" : "bg-slate-400"}`} aria-hidden="true" />
      {ai ? `AI mode · ${status.provider}` : "Offline mode"}
    </span>
  );
}

function Sources({ msg }) {
  const [open, setOpen] = useState(false);
  if (!msg.tools?.length) return null;
  return (
    <div className="mt-3 border-t border-line pt-2">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-[11px] text-muted hover:text-ink"
        aria-expanded={open}>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        Data used ({msg.tools.length}) · {msg.mode === "ai" ? "AI agent" : "offline engine"}
      </button>
      {open && msg.sources?.length ? (
        <div className="mt-2 space-y-2">
          {(msg.sources || []).map((s, i) => (
            <details key={i} className="rounded-lg border border-line bg-black/30">
              <summary className="cursor-pointer px-2.5 py-1.5 font-mono text-[11px] text-accent">{s.tool}</summary>
              <pre className="max-h-48 overflow-auto px-2.5 pb-2 font-mono text-[10.5px] leading-relaxed text-ink2">
                {JSON.stringify(s.data, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {msg.tools.map((t) => (
            <span key={t} className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10.5px] text-ink2">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Bubble({ msg }) {
  if (msg.role === "user") {
    return (
      <div className="rise flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-sky-500 to-violet-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-[0_10px_30px_-12px_rgba(56,189,248,0.6)]">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="rise flex gap-3">
      <div className="mt-0.5 shrink-0"><AiOrb size={34} /></div>
      <div className={`min-w-0 max-w-[88%] rounded-2xl rounded-tl-md border px-4 py-3 text-sm leading-relaxed text-ink2 ${
        msg.error ? "border-rose-400/30 bg-rose-500/10" : "border-line bg-white/[0.04]"}`}>
        <Markdown text={msg.content} />
        {msg.note && <p className="mt-2 text-[11px] text-warn">{msg.note}</p>}
        <Sources msg={msg} />
      </div>
    </div>
  );
}

export default function Ask({ coin }) {
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState(() => load(CHAT_KEY, [WELCOME], "session"));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const status = useApi((o) => api.askStatus(coin, o), [coin]);
  const scroller = useRef(null);
  const inputRef = useRef(null);
  const { holdings: portfolio } = usePortfolio();
  const { user } = useAuth();
  const chatLoadedFor = useRef(null);

  // signed in: restore the saved conversation from the account
  useEffect(() => {
    if (!user) { chatLoadedFor.current = null; return; }
    api.myChat().then(({ messages: saved }) => {
      if (saved?.length) setMessages(saved);
      chatLoadedFor.current = user.id;
    }).catch(() => { chatLoadedFor.current = user.id; });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const recent = messages.slice(-30);
    save(CHAT_KEY, recent, "session");
    if (user && chatLoadedFor.current === user.id) {
      // keep what's needed to re-render; drop bulky raw tool output
      api.saveMyChat(recent.map(({ sources, ...m }) => m)).catch(() => {}); // eslint-disable-line no-unused-vars
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);
  useEffect(() => { if (status.data) setSuggestions(status.data.suggestions); }, [status.data]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput("");
    const history = messages.filter((m) => m !== WELCOME && !m.error)
      .map(({ role, content }) => ({ role, content })).slice(-8);
    setMessages((m) => [...m, { role: "user", content: question }]);
    setBusy(true);
    try {
      const r = await api.ask({ question, coin, history, portfolio });
      setMessages((m) => [...m, {
        role: "assistant", content: r.answer, tools: r.tools_used, sources: r.sources, mode: r.mode, note: r.note,
      }]);
      if (r.suggestions?.length) setSuggestions(r.suggestions);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e.message, error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  // questions sent from other pages, e.g. /ask?q=How is my portfolio doing?
  const handledQ = useRef(false);
  useEffect(() => {
    const q = params.get("q");
    if (q && !handledQ.current) {
      handledQ.current = true; // React StrictMode runs effects twice in development
      const next = new URLSearchParams(params);
      next.delete("q");
      setParams(next, { replace: true });
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => { setMessages([WELCOME]); setSuggestions(status.data?.suggestions || []); };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* chat */}
      <section className="glass flex h-[calc(100vh-270px)] min-h-[520px] flex-col overflow-hidden rounded-2xl" aria-label="Chat">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-3">
            <AiOrb size={40} thinking={busy} />
            <div>
              <div className="font-display text-[15px] font-semibold text-ink">CryptoPulse AI</div>
              <div className="text-xs text-muted">{busy ? "Analysing data…" : `Context: ${coin}${portfolio.length ? ` · ${portfolio.length} holdings` : ""}`}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeBadge status={status.data} />
            <button onClick={reset} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-white/5 hover:text-ink" title="Start a new chat">
              ↺ New chat
            </button>
          </div>
        </header>

        <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {messages.map((m, i) => <Bubble key={i} msg={m} />)}
          {busy && (
            <div className="flex items-center gap-3">
              <AiOrb size={34} thinking />
              <div className="typing flex gap-1.5 rounded-2xl border border-line bg-white/[0.04] px-4 py-3.5" aria-label="Thinking">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line p-3 sm:p-4">
          {suggestions.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={busy}
                  className="glass tilt shrink-0 rounded-full px-3 py-1.5 text-xs text-ink2 hover:text-ink disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              maxLength={1000}
              placeholder={`Ask anything about ${coin} or your portfolio… (English / हिंदी)`}
              aria-label="Your question"
              className="max-h-32 min-h-[46px] flex-1 resize-none rounded-xl border border-line bg-black/30 px-4 py-3 text-[13px] sm:text-sm text-ink placeholder:text-muted focus:border-sky-400/50 focus:outline-none"
            />
            <button type="submit" disabled={busy || !input.trim()}
              className="brand-gradient flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-white shadow-[0_0_24px_-6px_var(--glow)] transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
              aria-label="Send">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" />
              </svg>
            </button>
          </form>
          <p className="mt-2 text-center text-[10.5px] text-muted">
            Answers come from this project's models. Not financial advice.
          </p>
        </div>
      </section>

      {/* side panel */}
      <aside className="space-y-6">
        <Card title="How it works" icon="✦">
          <div className="-mt-1 flex justify-center pb-2"><AiOrb size={110} thinking={busy} /></div>
          <ol className="space-y-3 text-xs leading-relaxed text-ink2">
            {[
              ["You ask", "in English, Hindi or Hinglish."],
              ["The agent picks tools", "forecast, SHAP explanation, risk, sentiment, model accuracy, your portfolio."],
              ["It reads real numbers", "from the same models behind every chart on this site."],
              ["It answers and shows its work", "open \"Data used\" under any reply."],
            ].map(([a, b], i) => (
              <li key={a} className="flex gap-3">
                <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-[11px] font-semibold text-accent">{i + 1}</span>
                <span><strong className="text-ink">{a}</strong> {b}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Your portfolio" icon="◈">
          {portfolio.length ? (
            <p className="text-xs text-ink2">
              {portfolio.length} holding{portfolio.length > 1 ? "s" : ""} shared with the assistant:{" "}
              <span className="text-ink">{portfolio.map((h) => h.coin).join(", ")}</span>. Try{" "}
              <button onClick={() => send("How is my portfolio doing?")} className="text-accent hover:underline">
                "How is my portfolio doing?"
              </button>
            </p>
          ) : (
            <p className="text-xs text-ink2">
              Add what you own on <Link to="/portfolio" className="text-accent hover:underline">My Portfolio</Link> and
              the assistant can answer questions about <em>your</em> money.
            </p>
          )}
        </Card>
        {status.data?.mode === "offline" && (
          <Card title="Want smarter answers?" icon="⚡">
            <p className="text-xs leading-relaxed text-ink2">
              Offline mode understands common questions. Add a free Gemini or Groq API key to
              <code className="mx-1 rounded bg-black/30 px-1 font-mono text-[11px]">backend/.env</code>
              to unlock full AI mode, which handles any question and replies in your language.
            </p>
          </Card>
        )}
      </aside>
    </div>
  );
}
