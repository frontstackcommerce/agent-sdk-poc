import { query, Options, SDKUserMessage, SDKMessage, PermissionResult, HookCallback } from "@anthropic-ai/claude-agent-sdk";
import path from "node:path";
import fs from "node:fs";
import { ConnectionManager } from "./server";

const AGENT_SDK_MCP_TOOLS = {
  READ: "Read",
  EDIT: "Edit",
  GLOB: "Glob",
  TASK: "Task",
  WRITE: "Write",
  ASK_USER_QUESTION: "AskUserQuestion",
  SKILL: "Skill",
}

interface UserQuestion {
  question: string;
  header: string;
  options: {
    label: string;
    description: string;
  }[];
  multiSelect: boolean;
}

let sessionId = '';
let transcriptPath = '';
const userPromptSubmitHook: HookCallback = async (input, toolUseId, options) => {
  sessionId = input.session_id
  transcriptPath = input.transcript_path
  return {};
}

export function getTranscriptPath(): string
{
  return transcriptPath
}

const abortController = new AbortController
export function getAbortController(): AbortController
{
  return abortController
}

const AGENT_OPTIONS: Options = {
  systemPrompt:
    fs.readFileSync(path.join(import.meta.dirname, '..', 'sub-agents', 'buddy.md'), 'utf8'),
  tools: [...Object.values(AGENT_SDK_MCP_TOOLS)],
  allowedTools: [
    // Built-in tools
    ...Object.values(AGENT_SDK_MCP_TOOLS),
    // Frontic MCP tools
    // ...Object.values(FRONTIC_MCP_TOOLS),
  ],
  mcpServers: {
    // fronticMcp
  },
  permissionMode: "acceptEdits", // plan = creates a plan file, acceptEdits = accepts the edits and returns the result
  model: "sonnet",
  includePartialMessages: true, // Enable streaming of partial messages for real-time output
  agents: {
    "frontend-engineer": {
      prompt:
        fs.readFileSync(path.join(import.meta.dirname, '..', 'sub-agents', 'frontend-engineer.md'), 'utf8'),
      description:
        "Senior frontend engineer who writes and modifies frontend code. Use when you need to CREATE or MODIFY code files. The engineer works independently and returns results when done.",
      tools: [...Object.values(AGENT_SDK_MCP_TOOLS), "Bash"]
    },
    "api-agent": {
      prompt:
        fs.readFileSync(path.join(import.meta.dirname, '..', 'sub-agents', 'api-agent.md'), 'utf8'),
      description:
        "API agent who creates and modifies API endpoints. Use when you need to CREATE or MODIFY API endpoints. The agent works independently and returns results when done.",
      tools: [...Object.values(AGENT_SDK_MCP_TOOLS)], // ...Object.values(FRONTIC_MCP_TOOLS)],
    },
  },
  settingSources: ['user'],
  hooks: {
    UserPromptSubmit: [{
      hooks: [userPromptSubmitHook],
    }],
  },
  cwd: path.join(import.meta.dirname, '..', '..', 'app'),
  additionalDirectories: [path.join(import.meta.dirname, '..', '..', 'app')],
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

export const runAgent = async (userPrompt: string, connectionManager: ConnectionManager) => {
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
    session_id: ''
  }

  // Required because we're using complex prompt objects instead of strings
  const userMessageIterable = async function* () {
    yield userMessage;
  }

  // TODO: Check if stream is still running (i.e. no message_end received, yet) and block new query

  // Agentic loop: streams messages as Claude works for this single user turn.
  // On subsequent turns, `continue: true` keeps the same conversation.
  for await (const message of query({
    prompt: userMessageIterable(),
    options: {
      ...AGENT_OPTIONS,
      continue: shouldContinueConversation,
    },
  })) {
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
      const modelName = model.replace('claude-', '').replace(/\d{8}$/, '').trim();
      const inTokens = (usage.inputTokens || 0) + (usage.cacheCreationInputTokens || 0);
      const outTokens = usage.outputTokens || 0;
      const cacheRead = usage.cacheReadInputTokens || 0;

      console.log(`   • ${modelName}: ${inTokens.toLocaleString()} in${cacheRead > 0 ? ` (+${cacheRead.toLocaleString()} cache)` : ''} / ${outTokens.toLocaleString()} out → $${usage.costUSD.toFixed(4)}`);
    }
  }
  console.log(); // Empty line after summary
}
