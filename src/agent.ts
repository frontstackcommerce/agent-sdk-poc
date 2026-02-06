import { query, Options, SDKUserMessage, HookCallback, McpServerConfig, AgentDefinition, Query } from "@anthropic-ai/claude-agent-sdk";
import path from "node:path";
import { ConnectionManager, messages } from "./server";

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
  agentIsActive = false;
  return {};
}

export function getTranscriptPath(): string {
  return transcriptPath;
}
export function isAgentStillActive() {
  return agentIsActive;
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
} as const;

let shouldContinueConversation = false;

export let activeStream: undefined|Query = undefined;
export function isInitialized(): boolean {
  return activeStream !== undefined;
}

export const runAgent = async (connectionManager: ConnectionManager, configuration: Configuration) => {
  // Required because we"re using complex prompt objects instead of strings
  const userMessageIterable = async function* (messages: string[]): AsyncIterable<SDKUserMessage> {
    while (true) {
      while (messages.length > 0) {
        const message = messages.shift();
        if (message === undefined) {
          continue;
        }

        const userMessage: SDKUserMessage = {
          type: "user",
          message: {
            role: "user",
            content: [{
              type: "text",
              text: message,
            }],
          },
          parent_tool_use_id: null,
          session_id: ""
        };

        connectionManager.broadcast(userMessage);

        yield userMessage!;
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // Agentic loop: streams messages as Claude works for this single user turn.
  // On subsequent turns, `continue: true` keeps the same conversation.
  activeStream = query({
    prompt: userMessageIterable(messages),
    options: {
      ...AGENT_OPTIONS,
      ...configuration,
      continue: shouldContinueConversation,
    },
  });
  for await (const message of activeStream) {
    connectionManager.broadcast(message);
  }

  shouldContinueConversation = true;
}
