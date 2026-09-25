import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute, useSearch } from "wouter";
import { api } from "../../lib/utils";
import { AppShell } from "../../components/AppShell";
import { showToast } from "../../lib/toast";
import {
  ChatComposer,
  ChatThread,
  providerLabel,
  type AiChatListResponse,
  type AiChatMessage,
} from "../../components/AiChat";
import { Plus, ChatCircle as ChatIcon, Trash as Trash2, Copy, Plugs } from "@phosphor-icons/react";

interface ConnectorStatus {
  url: string;
  allowed: boolean;
  connections: number;
}

/** How to add the platform to Claude (claude.ai / Desktop / Cowork), and an off switch. */
function ClaudeConnectorPanel() {
  const qc = useQueryClient();
  const { data } = useQuery<ConnectorStatus>({
    queryKey: ["mcp-connector"],
    queryFn: () => api("/api/admin/mcp-connector"),
  });
  if (!data) return null;

  async function disconnect() {
    if (!confirm("Disconnect Claude from your account? Claude will need to be connected again to read platform data.")) return;
    try {
      await api("/api/admin/mcp-connector/connections", { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["mcp-connector"] });
      showToast("Claude disconnected.");
    } catch (e: any) {
      showToast(e.message || "Couldn't disconnect");
    }
  }

  return (
    <div className="m-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
      <p className="mb-1 flex items-center gap-1.5 font-bold text-primary">
        <Plugs className="h-4 w-4" /> Use in Claude
      </p>
      {data.allowed ? (
        <>
          <p className="mb-2">
            In Claude, add a custom connector with this URL, then approve it here. It's read-only and only works for
            @open-startup.org admins.
          </p>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(data.url);
              showToast("Connector URL copied.");
            }}
            className="mb-2 flex w-full items-center gap-1.5 truncate rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left font-mono text-[11px] text-primary hover:border-secondary"
          >
            <Copy className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{data.url}</span>
          </button>
          <div className="flex items-center justify-between">
            <span>
              {data.connections === 0 ? "Not connected" : `Connected (${data.connections} app${data.connections > 1 ? "s" : ""})`}
            </span>
            {data.connections > 0 && (
              <button onClick={disconnect} className="font-semibold text-red-500 hover:underline">
                Disconnect
              </button>
            )}
          </div>
        </>
      ) : (
        <p>Only @open-startup.org admin accounts can connect Claude to the platform.</p>
      )}
    </div>
  );
}

interface AiChat {
  id: string;
  title: string;
  messages: AiChatMessage[];
}

const EXAMPLE_QUESTIONS = [
  "Which startups need attention?",
  "Which startups have a pending review?",
  "What's the total amount raised by Seed startups?",
  "What's the average team size?",
];

export default function AdminChats() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/admin/chats/:id");
  const id = params?.id ?? null;
  const search = useSearch();
  const [pending, setPending] = useState<string | null>(null);
  const startedFromQuery = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: list } = useQuery<AiChatListResponse>({
    queryKey: ["ai-chats"],
    queryFn: () => api("/api/admin/ai-chats"),
  });
  const { data: chat, isLoading: chatLoading } = useQuery<AiChat>({
    queryKey: ["ai-chat", id],
    queryFn: () => api(`/api/admin/ai-chats/${id}`),
    enabled: !!id,
  });

  const configured = list?.configured ?? true;

  async function send(question: string): Promise<boolean> {
    if (pending) return false;
    setPending(question);
    try {
      if (id) {
        const updated = await api<AiChat>(`/api/admin/ai-chats/${id}/messages`, {
          method: "POST",
          body: JSON.stringify({ question }),
        });
        qc.setQueryData(["ai-chat", id], updated);
      } else {
        const created = await api<AiChat>("/api/admin/ai-chats", {
          method: "POST",
          body: JSON.stringify({ question }),
        });
        qc.setQueryData(["ai-chat", created.id], created);
        navigate(`/admin/chats/${created.id}`, { replace: true });
      }
      qc.invalidateQueries({ queryKey: ["ai-chats"] });
      return true;
    } catch (e: any) {
      showToast(e.message || "Couldn't get an answer");
      return false;
    } finally {
      setPending(null);
    }
  }

  // Arriving from the dashboard's "Ask anything" box: /admin/chats?q=...
  useEffect(() => {
    if (id || startedFromQuery.current) return;
    const q = new URLSearchParams(search).get("q");
    if (!q) return;
    startedFromQuery.current = true;
    void send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, search]);

  const messages: AiChatMessage[] = [
    ...(id ? chat?.messages ?? [] : []),
    ...(pending ? [{ role: "user" as const, content: pending }] : []),
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  async function remove(chatId: string) {
    if (!confirm("Delete this chat? This can't be undone.")) return;
    try {
      await api(`/api/admin/ai-chats/${chatId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["ai-chats"] });
      qc.removeQueries({ queryKey: ["ai-chat", chatId] });
      if (chatId === id) navigate("/admin/chats");
    } catch (e: any) {
      showToast(e.message || "Couldn't delete this chat");
    }
  }

  const chats = list?.chats ?? [];
  const showEmptyState = !id && !pending;

  return (
    <AppShell>
      <main className="flex min-h-0 flex-1">
        {/* Chat list */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen">
          <div className="p-4">
            <button onClick={() => navigate("/admin/chats")} className="ost-btn-primary w-full">
              <Plus className="h-4 w-4" /> New chat
            </button>
          </div>
          <p className="px-5 pb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Chats</p>
          <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
            {chats.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No chats yet.</p>}
            {chats.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  c.id === id ? "bg-secondary/10 text-secondary" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <button onClick={() => navigate(`/admin/chats/${c.id}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChatIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.title}</span>
                </button>
                <button
                  onClick={() => remove(c.id)}
                  aria-label="Delete chat"
                  className="shrink-0 text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <ClaudeConnectorPanel />
        </aside>

        {/* Conversation */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 px-6 py-8">
            <div className="mx-auto max-w-3xl">
              {showEmptyState ? (
                <div className="pt-12">
                  <h1 className="ost-page-title">New chat</h1>
                  <p className="mt-2 ost-page-subtext">
                    Ask anything about the program — startups, tracks, funding, revenue, team size, review status.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {EXAMPLE_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        disabled={!configured}
                        className="ost-btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : id && chatLoading && !pending ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : (
                <>
                  {chat?.title && id && <h1 className="mb-6 text-lg font-bold text-primary">{chat.title}</h1>}
                  <ChatThread messages={messages} thinking={!!pending} />
                </>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-slate-200 bg-[#F2EFE9]/95 px-6 py-4 backdrop-blur">
            <div className="mx-auto max-w-3xl">
              {!configured && (
                <p className="mb-2 text-xs text-red-500">Ask AI isn't set up on the server yet (no AI API key configured).</p>
              )}
              <ChatComposer
                onSend={send}
                busy={!!pending}
                disabled={!configured}
                placeholder={id ? "Ask a follow-up..." : "Ask anything..."}
                footerLabel={providerLabel(list?.provider ?? null)}
                autoFocus
              />
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
