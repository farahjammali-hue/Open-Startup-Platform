import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import "dotenv/config";
import { storage } from "./storage";

/**
 * "Ask AI" tool-use chat: an admin asks a plain-English question about the
 * program and Claude/GPT answers it by calling a small set of curated,
 * read-only functions — never raw document/contract contents, matching the
 * privacy boundary the earlier keyword-matching "preview" mode already
 * documented. Provider is picked by whichever API key is configured
 * (ANTHROPIC_API_KEY, OPENAI_API_KEY); if both are set, ANTHROPIC_API_KEY
 * wins unless AI_CHAT_PROVIDER says otherwise.
 */

const ANTHROPIC_MODEL = "claude-opus-5";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-6-astra";

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const anthropicClient = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
const openaiClient = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

export type ChatProvider = "anthropic" | "openai";

const configuredProvider = ((): ChatProvider | null => {
  const forced = (process.env.AI_CHAT_PROVIDER || "").trim().toLowerCase();
  if (forced === "anthropic" && anthropicClient) return "anthropic";
  if (forced === "openai" && openaiClient) return "openai";
  if (anthropicClient) return "anthropic";
  if (openaiClient) return "openai";
  return null;
})();

export const aiChatProvider: ChatProvider | null = configuredProvider;
export const aiChatConfigured = configuredProvider !== null;

if (!aiChatConfigured) {
  console.warn(
    "[ai-chat] Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set — Ask AI falls back to keyword-matching preview mode.",
  );
}

export interface ChatTurn {
  question: string;
  answer: string;
}

/* ---------------- Curated, read-only tool catalog ----------------
 * Every tool here maps 1:1 to an existing storage aggregate/qualitative
 * function that already excludes admin demo startups and never touches
 * document/contract file contents. */

interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

const TOOLS: ToolDef[] = [
  {
    name: "count_startups",
    description: "Count how many real startups are in the program, optionally filtered to one KYS track.",
    parameters: {
      type: "object",
      properties: { track: { type: "string", enum: ["seed", "pre_seed"], description: "Omit for every track." } },
      required: [],
    },
  },
  {
    name: "startup_metric_summary",
    description: "Sum a numeric metric (valuation, amount raised, or total revenue) across startups, optionally filtered to one track.",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["lastValuation", "amountRaised", "totalRevenueSinceFounding"] },
        track: { type: "string", enum: ["seed", "pre_seed"], description: "Omit for every track." },
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
    name: "list_startup_names",
    description: "List every real startup's id, company name, and stage. Use this first to find a startup's id before calling get_startup_profile.",
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
  {
    name: "get_startup_profile",
    description: "Get one startup's qualitative profile (description, location, markets, stage, track, team size, contract/KYS status) by id. Never returns document/file contents.",
    parameters: {
      type: "object",
      properties: { startupId: { type: "string" } },
      required: ["startupId"],
    },
  },
];

async function executeTool(name: string, input: any): Promise<unknown> {
  switch (name) {
    case "count_startups":
      return { count: await storage.countStartups(input?.track) };
    case "startup_metric_summary":
      return storage.startupMetricSummary(input.metric, input?.track);
    case "average_team_size":
      return storage.averageTeamSize();
    case "list_startup_names":
      return storage.listStartupNames();
    case "list_startups_by_track":
      return storage.listStartupNamesByTrack(input.track);
    case "list_startups_needing_attention":
      return storage.listStartupsNeedingAttention();
    case "list_startups_with_pending_reviews":
      return storage.listStartupsWithPendingReviews();
    case "get_startup_profile": {
      const profile = await storage.getStartupQualitativeProfile(input.startupId);
      return profile ?? { error: "No startup with that id" };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const SYSTEM_PROMPT =
  "You are the Open Startup Platform's internal admin assistant. Answer questions about the accelerator " +
  "program (startup counts, valuations, funding, revenue, team sizes, tracks, review status, and individual " +
  "startups' qualitative profiles) using the tools provided. Always call a tool rather than guessing a number. " +
  "Keep answers short, factual, and in plain English — a sentence or two, not a report. If a question isn't " +
  "about program data (e.g. it asks for document/contract contents, which no tool exposes), say so plainly.";

const MAX_TOOL_ROUNDS = 6;

async function askAnthropic(question: string, history: ChatTurn[]): Promise<string> {
  const messages: Anthropic.MessageParam[] = [];
  for (const turn of history) {
    messages.push({ role: "user", content: turn.question });
    messages.push({ role: "assistant", content: turn.answer });
  }
  messages.push({ role: "user", content: question });

  const tools: Anthropic.Tool[] = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropicClient!.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      return textBlock?.text?.trim() || "I didn't get a text answer for that.";
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      let result: unknown;
      try {
        result = await executeTool(block.name, block.input);
      } catch (error: any) {
        toolResults.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: String(error.message || error) });
        continue;
      }
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }
  return "That question needed more steps than I could take — try asking something narrower.";
}

async function askOpenAI(question: string, history: ChatTurn[]): Promise<string> {
  const input: OpenAI.Responses.ResponseInputItem[] = [];
  for (const turn of history) {
    input.push({ role: "user", content: turn.question });
    input.push({ role: "assistant", content: turn.answer });
  }
  input.push({ role: "user", content: question });

  const tools: OpenAI.Responses.Tool[] = TOOLS.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    strict: false,
  }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await openaiClient!.responses.create({
      model: OPENAI_MODEL,
      instructions: SYSTEM_PROMPT,
      tools,
      input,
    });

    const functionCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === "function_call",
    );

    if (functionCalls.length === 0) {
      return response.output_text?.trim() || "I didn't get a text answer for that.";
    }

    // response.output -> input round-trip is runtime-compatible; the SDK's
    // output/input types only diverge on a computer-use variant we never use.
    input.push(...(response.output as unknown as OpenAI.Responses.ResponseInputItem[]));
    for (const call of functionCalls) {
      let result: unknown;
      try {
        result = await executeTool(call.name, JSON.parse(call.arguments || "{}"));
      } catch (error: any) {
        result = { error: String(error.message || error) };
      }
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
    }
  }
  return "That question needed more steps than I could take — try asking something narrower.";
}

/** Throws if aiChatConfigured is false — callers should check that first and fall back to preview mode. */
export async function askAi(question: string, history: ChatTurn[] = []): Promise<{ answer: string; provider: ChatProvider }> {
  if (configuredProvider === "anthropic") {
    return { answer: await askAnthropic(question, history), provider: "anthropic" };
  }
  if (configuredProvider === "openai") {
    return { answer: await askOpenAI(question, history), provider: "openai" };
  }
  throw new Error("AI chat is not configured — set ANTHROPIC_API_KEY or OPENAI_API_KEY");
}
