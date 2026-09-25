import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { showToast } from "../lib/toast";
import { Copy, Plugs } from "@phosphor-icons/react";

interface ConnectorStatus {
  url: string;
  allowed: boolean;
  connections: number;
}

/** How to add the platform to Claude (claude.ai / Desktop / Cowork), and an off switch. */
export function ClaudeConnectorPanel() {
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
    <div className="ost-card flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
          <Plugs className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-primary">Use the platform in Claude</p>
          {data.allowed ? (
            <p className="text-sm text-slate-500">
              Add a custom connector in Claude with this URL. Read-only, @open-startup.org admins only.{" "}
              <span className="font-semibold">
                {data.connections === 0
                  ? "Not connected yet."
                  : `Connected (${data.connections} app${data.connections > 1 ? "s" : ""}).`}
              </span>
            </p>
          ) : (
            <p className="text-sm text-slate-500">Only @open-startup.org admin accounts can connect Claude to the platform.</p>
          )}
        </div>
      </div>
      {data.allowed && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(data.url);
              showToast("Connector URL copied.");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-primary hover:border-secondary"
          >
            <Copy className="h-3.5 w-3.5 shrink-0" /> {data.url}
          </button>
          {data.connections > 0 && (
            <button onClick={disconnect} className="text-sm font-semibold text-red-500 hover:underline">
              Disconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}
