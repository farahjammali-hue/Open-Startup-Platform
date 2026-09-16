import { Pills } from "../StartupFormFields";

export type SessionVisibilityMode = "default" | "track" | "startups";

export interface StartupOption {
  id: string;
  companyName: string;
}

const TRACK_OPTIONS = [
  { value: "seed", label: "Seed" },
  { value: "pre_seed", label: "Pre-Seed" },
  { value: "all", label: "All startups" },
];

/**
 * Lets an admin pick who a Mentorship/Training session is visible to, on top
 * of its owner (Mentorship) or its module's own track (Training): the
 * default, a whole track, or an explicit list of startups. Track and
 * explicit-list are mutually exclusive — picking one clears the other.
 */
export function SessionVisibilityPicker({
  defaultLabel,
  mode,
  onModeChange,
  track,
  onTrackChange,
  startupIds,
  onStartupIdsChange,
  startups,
  excludeStartupId,
}: {
  defaultLabel: string;
  mode: SessionVisibilityMode;
  onModeChange: (mode: SessionVisibilityMode) => void;
  track: string;
  onTrackChange: (track: string) => void;
  startupIds: string[];
  onStartupIdsChange: (ids: string[]) => void;
  startups: StartupOption[];
  /** Excluded from the "specific startups" list — already implicitly included (e.g. Mentorship's owning startup). */
  excludeStartupId?: string;
}) {
  const modeOptions = [
    { value: "default", label: defaultLabel },
    { value: "track", label: "A track" },
    { value: "startups", label: "Specific startups" },
  ];
  const selectable = excludeStartupId ? startups.filter((s) => s.id !== excludeStartupId) : startups;

  function toggleStartup(id: string) {
    onStartupIdsChange(startupIds.includes(id) ? startupIds.filter((x) => x !== id) : [...startupIds, id]);
  }

  return (
    <div>
      <label className="ost-label">Visible to</label>
      <Pills options={modeOptions} value={mode} onChange={(v) => onModeChange((v || "default") as SessionVisibilityMode)} />

      {mode === "track" && (
        <div className="mt-3">
          <Pills options={TRACK_OPTIONS} value={track} onChange={onTrackChange} />
        </div>
      )}

      {mode === "startups" && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {selectable.length === 0 && <p className="px-1.5 py-1 text-xs text-slate-400">No other startups yet.</p>}
          {selectable.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-primary hover:bg-slate-50">
              <input type="checkbox" checked={startupIds.includes(s.id)} onChange={() => toggleStartup(s.id)} />
              {s.companyName}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
