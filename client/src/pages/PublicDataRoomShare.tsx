import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/utils";
import { Logo } from "../components/Brand";
import { StatusBadge } from "../components/StatusBadge";
import { REVIEW_STATUS_TONES, REVIEW_STATUS_ICONS, type ReviewStatus } from "../lib/statusTones";
import { CATEGORY_LABELS, type DocumentCategory } from "../lib/documentCategories";
import { FileText, ExternalLink, FolderLock, Ban, Building2 } from "lucide-react";

interface SharedDoc {
  id: string;
  title: string;
  category: DocumentCategory;
  fileUrl: string;
  fileName: string;
  status: ReviewStatus;
}
interface ShareView {
  companyName: string;
  logoUrl: string | null;
  title: string | null;
  createdAt: string;
  expiresAt: string;
  documents: SharedDoc[];
}

/** Public, unauthenticated page — anyone with the link can view (never edit) the documents a founder chose to share. */
export default function PublicDataRoomShare() {
  const [, params] = useRoute("/share/data-room/:token");
  const token = params?.token ?? "";

  const { data, isLoading, error } = useQuery<ShareView>({
    queryKey: ["public-data-room-share", token],
    queryFn: () => api(`/api/public/data-room-share/${token}`),
    enabled: !!token,
    retry: false,
  });

  return (
    <div className="ost-canvas min-h-screen">
      <header className="flex items-center justify-center border-b border-white/10 px-6 py-5">
        <Logo className="[&_*]:text-white" />
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        {isLoading && (
          <div className="ost-card p-8 text-center">
            <p className="ost-card-subtext">Loading shared documents…</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="ost-card flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <Ban className="h-7 w-7" />
            </div>
            <h1 className="text-lg font-extrabold text-primary">This link isn't available</h1>
            <p className="max-w-sm text-sm text-slate-500">
              {(error as any)?.message || "This link has expired, been revoked, or doesn't exist. Ask the sender for a new one."}
            </p>
          </div>
        )}

        {!isLoading && data && (
          <div className="space-y-6">
            <div className="ost-card p-8">
              <div className="flex items-center gap-4">
                {data.logoUrl ? (
                  <img src={data.logoUrl} alt="" className="h-12 w-12 rounded-xl border border-slate-100 object-contain" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="ost-helper-text">Shared by</p>
                  <h1 className="truncate text-xl font-extrabold text-primary">{data.companyName}</h1>
                </div>
              </div>
              {data.title && <p className="mt-4 text-sm font-medium text-slate-600">{data.title}</p>}
              <p className="mt-2 text-xs text-slate-400">
                Read-only · expires {new Date(data.expiresAt).toLocaleDateString()}
              </p>
            </div>

            {data.documents.length === 0 ? (
              <div className="ost-card flex flex-col items-center gap-3 p-10 text-center">
                <FolderLock className="h-7 w-7 text-slate-300" />
                <p className="text-sm text-slate-500">No documents are available in this share anymore.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.documents.map((d) => (
                  <div key={d.id} className="ost-card flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-secondary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-primary">{d.title}</p>
                        <p className="truncate text-xs text-slate-400">{CATEGORY_LABELS[d.category] || d.category} · {d.fileName}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge tone={REVIEW_STATUS_TONES[d.status]} icon={REVIEW_STATUS_ICONS[d.status]}>{d.status}</StatusBadge>
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="ost-btn-ghost !px-2.5 !py-1.5 text-xs">
                        <ExternalLink className="h-3.5 w-3.5" /> View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
