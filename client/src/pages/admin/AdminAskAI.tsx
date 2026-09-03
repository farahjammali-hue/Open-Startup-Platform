import { useState } from "react";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { BackLink, PageHeader } from "../../components/PageHeader";
import { showToast } from "../../lib/toast";
import { Sparkles, Send, Loader2, Bot, User } from "lucide-react";

interface ChatTurn {
  question: string;
  answer: string;
  unmatched?: boolean;
}

const EXAMPLE_QUESTIONS = [
  "What's the cumulative valuation of Seed startups?",
  "Which startups need attention?",
  "Which startups have a pending review?",
  "List Seed startups",
];

export default function AdminAskAI() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [asking, setAsking] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || asking) return;
    setAsking(true);
    setInput("");
    try {
      const res = await api<{ answer: string; unmatched?: boolean }>("/api/admin/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setTurns((t) => [...t, { question, answer: res.answer, unmatched: res.unmatched }]);
    } catch (e: any) {
      showToast(e.message || "Couldn't get an answer");
    } finally {
      setAsking(false);
    }
  }

  return (
    <AppShell>
      <main className="ost-page">
        <BackLink to="/admin" label="Back to Admin Dashboard" />
        <PageHeader
          eyebrow="Administration"
          title="Ask AI"
          subtitle="Ask a question about the program in plain English."
        />

        <div className="mt-4 flex items-start gap-3 rounded-lg bg-turq-bg p-4 text-sm text-turq-text">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <b className="block">Preview mode</b>
            This answers a curated set of questions — totals, counts, and qualitative fields like
            stage, status, and descriptions — using keyword matching against your real data, not a
            real LLM yet. It never reads contract/document contents. Connect an Anthropic API key
            to let it understand any question.
          </div>
        </div>

        <div className="mt-6 ost-card p-6">
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className="ost-btn-ghost !px-3 !py-1.5 text-xs"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {turns.length > 0 && (
            <div className="space-y-4">
              {turns.map((t, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-primary">{t.question}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <p className={`mt-1 text-sm ${t.unmatched ? "text-slate-400 italic" : "text-slate-600"}`}>{t.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4"
          >
            <input
              className="ost-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about valuations, funding, revenue, startup counts, team size…"
              disabled={asking}
            />
            <button type="submit" className="ost-btn-primary !px-3 !py-2.5 disabled:cursor-not-allowed disabled:opacity-50" disabled={asking || !input.trim()}>
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
