import { query, Options, SDKUserMessage, SDKMessage, HookCallback, McpServerConfig, AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import path from "node:path";
import { ConnectionManager } from "./server";
import "dotenv/config";

console.log(process.env)

export type Configuration = {
  agents: Record<string, AgentDefinition>
  /**
   * allowedTools: ["mcp__secure-api__*"]
   */
  allowedTools?: string[]
  /**
   * mcpServers: {
      "secure-api": {
        type: "http",
        url: "https://api.example.com/mcp",
        headers: {
          Authorization: "Bearer some-token"
        }
      }
    },
   */
  mcpServers?: Record<string, McpServerConfig>
  systemPrompt?: string
};

let sessionId = "";
let transcriptPath = "";
let agentIsActive = false;

const userPromptSubmitHook: HookCallback = async (input) => {
  sessionId = input.session_id;
  transcriptPath = input.transcript_path;
  agentIsActive = true;
  return {};
}

const stopHook: HookCallback = async () => {
  // TODO: Can we get usage (token, money) here to pass to backend?
  agentIsActive = false;
  return {};
}

export function getTranscriptPath(): string {
  return transcriptPath;
}
export function isAgentStillActive() {
  return agentIsActive;
}

const abortController = new AbortController
export function getAbortController(): AbortController {
  return abortController;
}

const AGENT_OPTIONS: Options = {
  permissionMode: "acceptEdits", // plan = creates a plan file, acceptEdits = accepts the edits and returns the result
  model: "sonnet",
  includePartialMessages: true, // Enable streaming of partial messages for real-time output
  settingSources: ["user"],
  hooks: {
    UserPromptSubmit: [{
      hooks: [userPromptSubmitHook],
    }],
    Stop: [{
      hooks: [stopHook],
    }]
  },
  cwd: path.join(import.meta.dirname, "..", "..", "app"),
  additionalDirectories: [path.join(import.meta.dirname, "..", "..", "app")],
  canUseTool: async (toolName, input) => {
    return {
      behavior: "allow",
      updatedInput: input,
    }
  },
  resume: sessionId, // Resume with a previous Claude session ID
  abortController: abortController
} as const;

let shouldContinueConversation = false;

export const runAgent = async (userPrompt: string, connectionManager: ConnectionManager, configuration: Configuration) => {
  const userMessage: SDKUserMessage = {
    type: "user",
    message: {
      role: "user",
      content: [{
        type: "text",
        text: userPrompt,
      }],
    },
    parent_tool_use_id: null,
    session_id: ""
  };

  // Required because we"re using complex prompt objects instead of strings
  const userMessageIterable = async function* () {
    yield userMessage;
  }

  // Agentic loop: streams messages as Claude works for this single user turn.
  // On subsequent turns, `continue: true` keeps the same conversation.
  for await (const message of query({
    prompt: userMessageIterable(),
    options: {
      ...AGENT_OPTIONS,
      ...configuration,
      continue: shouldContinueConversation,
    },
  })) {
    if (message.type === "system" && message.subtype === "init") {
      console.log("Available MCP tools:", message.mcp_servers);
    }
    connectionManager.broadcast(message);
  }

  shouldContinueConversation = true;
}

function printPriceSummary(message: SDKMessage) {
  if (message.type !== "result") return;
  if (!message.total_cost_usd && !message.modelUsage) return;

  console.log("\n💰 Price Summary:");

  // Total tokens and cost
  if (message.usage) {
    const totalInput = (message.usage.input_tokens || 0) +
      (message.usage.cache_creation_input_tokens || 0) +
      (message.usage.cache_read_input_tokens || 0);
    const totalOutput = message.usage.output_tokens || 0;
    console.log(`   Tokens: ${totalInput.toLocaleString()} in / ${totalOutput.toLocaleString()} out`);
  }

  if (message.total_cost_usd !== undefined) {
    console.log(`   Total: $${message.total_cost_usd.toFixed(4)}`);
  }

  // Per-model breakdown
  if (message.modelUsage) {
    console.log("\n   Model breakdown:");
    for (const [model, usage] of Object.entries(message.modelUsage)) {
      const modelName = model.replace("claude-", "").replace(/\d{8}$/, "").trim();
      const inTokens = (usage.inputTokens || 0) + (usage.cacheCreationInputTokens || 0);
      const outTokens = usage.outputTokens || 0;
      const cacheRead = usage.cacheReadInputTokens || 0;

      console.log(`   • ${modelName}: ${inTokens.toLocaleString()} in${cacheRead > 0 ? ` (+${cacheRead.toLocaleString()} cache)` : ""} / ${outTokens.toLocaleString()} out → $${usage.costUSD.toFixed(4)}`);
    }
  }
  console.log(); // Empty line after summary
}
