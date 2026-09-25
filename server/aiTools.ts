import { storage } from "./storage";

/**
 * Curated, read-only data lookups exposed through the Claude connector
 * (server/mcp.ts). Every tool maps
 * to an existing storage query that already excludes admin demo startups and
 * never touches document/contract file contents, so anything reachable here is
 * data an admin can already see in the platform.
 */

export interface AiToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

const TRACK = { type: "string", enum: ["seed", "pre_seed"], description: "Omit for every track." };

export const AI_TOOLS: AiToolDef[] = [
  {
    name: "list_startups",
    description:
      "List every real startup in the program with its founder's name and email, location, stage, KYS track, " +
      "KYS and contract review status, assigned mentor and trainer. Use this to find a startup's id or a " +
      "founder's contact details.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_startup_profile",
    description:
      "Get one startup's qualitative profile (description, location, markets, stage, track, team size, " +
      "contract/KYS status) by id. Never returns document/file contents.",
    parameters: { type: "object", properties: { startupId: { type: "string" } }, required: ["startupId"] },
  },
  {
    name: "count_startups",
    description: "Count how many real startups are in the program, optionally filtered to one KYS track.",
    parameters: { type: "object", properties: { track: TRACK }, required: [] },
  },
  {
    name: "startup_metric_summary",
    description: "Sum a numeric metric (valuation, amount raised, or total revenue) across startups, optionally filtered to one track.",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["lastValuation", "amountRaised", "totalRevenueSinceFounding"] },
        track: TRACK,
      },
      required: ["metric"],
    },
  },
  {
    name: "average_team_size",
    description: "Average team size across every startup in the program.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_startups_by_track",
    description: "List startup company names and stage for one KYS track.",
    parameters: {
      type: "object",
      properties: { track: { type: "string", enum: ["seed", "pre_seed"] } },
      required: ["track"],
    },
  },
  {
    name: "list_startups_needing_attention",
    description: "List startups whose latest quarterly update is flagged at-risk/off-track, or that asked for support.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_startups_with_pending_reviews",
    description: "List startups with a Contract and/or KYS submission still awaiting admin review.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

export async function executeAiTool(name: string, input: any): Promise<unknown> {
  switch (name) {
    case "list_startups":
      return (await storage.listStartupsWithOwners()).map((s) => ({
        id: s.id,
        companyName: s.companyName,
        founderName: s.ownerName,
        founderEmail: s.ownerEmail,
        website: s.website,
        location: s.location,
        stage: s.stage,
        track: s.kysTrack,
        kysStatus: s.kysStatus,
        contractStatus: s.contractStatus,
        mentor: s.mentorName,
        trainer: s.trainerName,
        deletionRequested: !!s.deletionRequestedAt,
      }));
    case "get_startup_profile": {
      const id = String(input?.startupId ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "startupId must be a startup id from list_startups" };
      const profile = await storage.getStartupQualitativeProfile(id);
      return profile ?? { error: "No startup with that id" };
    }
    case "count_startups":
      return { count: await storage.countStartups(input?.track) };
    case "startup_metric_summary":
      return storage.startupMetricSummary(input?.metric, input?.track);
    case "average_team_size":
      return storage.averageTeamSize();
    case "list_startups_by_track":
      return storage.listStartupNamesByTrack(input?.track);
    case "list_startups_needing_attention":
      return storage.listStartupsNeedingAttention();
    case "list_startups_with_pending_reviews":
      return storage.listStartupsWithPendingReviews();
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
