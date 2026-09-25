import { useState, type KeyboardEvent } from "react";
import { PaperPlaneTilt as Send, CircleNotch as Loader2, Sparkle as Sparkles } from "@phosphor-icons/react";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface AiChatListResponse {
  configured: boolean;
  provider: "anthropic" | "openai" | null;
  chats: AiChatSummary[];
}

export function providerLabel(provider: AiChatListResponse["provider"]) {
  return provider === "openai" ? "GPT" : provider === "anthropic" ? "Claude" : null;
}

/** "Ask anything..." box. Enter sends, Shift+Enter adds a new line. */
export function ChatComposer({
  onSend,
  busy,
  disabled,
  placeholder = "Ask anything...",
  footerLabel,
  autoFocus,
}: {
  /** Resolve to false when sending failed, and the typed text is put back. */
  onSend: (text: string) => void | Promise<boolean | void>;
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  footerLabel?: string | null;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const canSend = !!text.trim() && !busy && !disabled;

  async function submit() {
    if (!canSend) return;
    const sent = text.trim();
    setText("");
    if ((await onSend(sent)) === false) setText(sent);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm focus-within:border-secondary">
      <textarea
        className="block min-h-[64px] w-full resize-none border-0 bg-transparent px-1 text-sm text-primary outline-none placeholder:text-slate-400"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={2000}
      />
      <div className="mt-1 flex items-center justify-end gap-3">
        {footerLabel && (
          <span className="flex items-center gap-1 text-xs font-semibold text-slate-400">
            <Sparkles className="h-3.5 w-3.5" /> {footerLabel}
          </span>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function ChatThread({ messages, thinking }: { messages: AiChatMessage[]; thinking?: boolean }) {
  return (
    <div className="space-y-4">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white">
              {m.content}
            </div>
          </div>
        ) : (
          <div key={i} className="flex justify-start">
            <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
              {m.content}
            </div>
          </div>
        ),
      )}
      {thinking && (
        <div className="flex justify-start">
          <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        </div>
      )}
    </div>
  );
}
