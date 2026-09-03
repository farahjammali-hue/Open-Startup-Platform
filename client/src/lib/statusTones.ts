import { Clock, CheckCircle2, XCircle } from "lucide-react";
import type { StatusTone } from "../components/StatusBadge";
import type { ReviewStatus } from "./kysStatus";

export type { ReviewStatus };

/** Shared by every admin-review surface (contracts, KYS, data room documents) and their founder-facing counterparts. */
export const REVIEW_STATUS_TONES: Record<ReviewStatus, StatusTone> = { pending: "amber", approved: "teal", rejected: "red" };
export const REVIEW_STATUS_ICONS: Record<ReviewStatus, typeof Clock> = { pending: Clock, approved: CheckCircle2, rejected: XCircle };

/** Office hour bookings use a different key ("booked" instead of "scheduled") but the same color logic. */
export type BookingStatus = "booked" | "completed" | "cancelled";
export const BOOKING_STATUS_TONES: Record<BookingStatus, StatusTone> = { booked: "teal", completed: "primary", cancelled: "red" };
export const BOOKING_STATUS_ICONS: Partial<Record<BookingStatus, typeof Clock>> = { completed: CheckCircle2, cancelled: XCircle };

/** Mentorship sessions (inside a Mentorship module). */
export type MentorshipSessionStatus = "upcoming" | "completed";
export const MENTORSHIP_SESSION_STATUS_TONES: Record<MentorshipSessionStatus, StatusTone> = { upcoming: "amber", completed: "primary" };
export const MENTORSHIP_SESSION_STATUS_ICONS: Record<MentorshipSessionStatus, typeof Clock> = { upcoming: Clock, completed: CheckCircle2 };
