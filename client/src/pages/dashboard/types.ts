import type { StatusTone } from "../../components/StatusBadge";
import type { KpiPhase } from "../../lib/kpiPhases";
import { MONTH_NAMES } from "../../lib/months";

export { MONTH_NAMES };

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: "on_track" | "at_risk" | "off_track" | "done";
}

export interface KpiSubmission {
  id: string;
  phase: KpiPhase;
  revenue: number | null;
  activeUsers: number | null;
  newCustomers: number | null;
  burnRate: number | null;
  cashOnHand: number | null;
  teamSize: number | null;
  runwayMonths: number | null;
  notes: string | null;
}

export interface MonthlyUpdateRow {
  id: string;
  periodMonth: number;
  periodYear: number;
  achieved: string;
  blocked: string;
  focusNext: string;
  status: "on_track" | "at_risk" | "off_track";
  supportNeeded: string | null;
}

export interface TeamMemberRow {
  id: string;
  name: string;
  role: string | null;
  type: "founder" | "full_time" | "part_time" | "advisor";
  joinedAt: string;
}

export interface CapTableEntryRow {
  id: string;
  name: string;
  percentage: number;
}

export const GOAL_STATUS_LABELS: Record<Goal["status"], string> = {
  on_track: "On track", at_risk: "At risk", off_track: "Off track", done: "Done",
};
export const GOAL_STATUS_TONES: Record<Goal["status"], StatusTone> = {
  on_track: "teal", at_risk: "amber", off_track: "red", done: "primary",
};
export const MONTHLY_STATUS_LABELS: Record<MonthlyUpdateRow["status"], string> = {
  on_track: "On track", at_risk: "At risk", off_track: "Off track",
};
export const MONTHLY_STATUS_TONES: Record<MonthlyUpdateRow["status"], StatusTone> = {
  on_track: "teal", at_risk: "amber", off_track: "red",
};
