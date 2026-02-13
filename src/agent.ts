import path from "node:path";
import { query, Options, SDKUserMessage, HookCallback, McpServerConfig, AgentDefinition, Query, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { ConnectionManager, messages, connectionManager, AskUserQuestionInput, FronticMessage, UserQuestionAnswer } from "./server";
import { ContentBlockParam } from "@anthropic-ai/sdk/resources";
import { getSessionId, getTranscriptPath as getSavedTranscriptPath, saveSessionInfo } from "./session";

export type Configuration = {
  agents: Record<string, AgentDefinition>
  allowedTools?: string[]
  mcpServers?: Record<string, McpServerConfig>
  systemPrompt?: string
};

let sessionId = getSessionId();
let transcriptPath = getSavedTranscriptPath();
let agentIsActive = false;

const userPromptSubmitHook: HookCallback = async (input) => {
  sessionId = input.session_id;
  transcriptPath = input.transcript_path;

  saveSessionInfo(sessionId, transcriptPath)

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

let waitForUserAnswers: boolean = false;
let userAnswers: UserQuestionAnswer | undefined = undefined;

/**
 * Handles the user question and waits for the user to answer.
 */
const handleUserQuestion = async (input: AskUserQuestionInput, connectionManager: ConnectionManager): Promise<PermissionResult> => {
  connectionManager.broadcast({ type: "ask_user_question", data: input })

  waitForUserAnswers = true;
  while(waitForUserAnswers) {
    if(userAnswers) {
      waitForUserAnswers = false;
      const answers = userAnswers;
      userAnswers = undefined;
      return {
        behavior: "allow",
        updatedInput: {
          ...input,
          answers: answers,
        },
      }
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return {
    behavior: "allow",
    updatedInput: input,
  }
}

const AGENT_OPTIONS: Options = {
  stderr(data) {
    console.error("Agent stderr:", data);
  },
  permissionMode: "acceptEdits", // plan = creates a plan file, acceptEdits = accepts the edits and returns the result
  model: "sonnet",
  includePartialMessages: true, // Enable streaming of partial messages for real-time output
  settingSources: ["project"],
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
    if(toolName === 'AskUserQuestion') {
      return await handleUserQuestion(input as AskUserQuestionInput, connectionManager);
    }

    return {
      behavior: "allow",
      updatedInput: input
    }
  },
};

let shouldContinueConversation = false;

export let activeStream: undefined|Query = undefined;
export function isInitialized(): boolean {
  return activeStream !== undefined;
}

export const runAgent = async (connectionManager: ConnectionManager, configuration: Configuration) => {
  // Required because we"re using complex prompt objects instead of strings
  const userMessageIterable = async function* (messages: FronticMessage[]): AsyncIterable<SDKUserMessage> {
    while (true) {
      while (messages.length > 0) {
        const message = messages.shift();
        if (message === undefined) {
          continue;
        }

        // Handle user question responses
        if(waitForUserAnswers && message.type === "ask_user_question_response") {
          userAnswers = message.data;
          connectionManager.broadcast(message);
          continue;
        }

        // Only broadcast user messages
        if(message.type !== "user_message") {
          continue;
        }

        const userMessage: SDKUserMessage = {
          type: "user",
          message: {
            role: "user",
            content: [{
              type: "text",
              text: message.data.message,
            }],
          },
          parent_tool_use_id: null,
          session_id: ""
        };

        for (const image of message.data.images) {
          const imageData = image.match(/^data:([^;]+);base64,(.+)$/)
          if (imageData) {
            const mimeType = imageData[1] as
              | 'image/jpeg'
              | 'image/png'
              | 'image/gif'
              | 'image/webp';
            const base64Data = imageData[2];

            (userMessage.message.content as ContentBlockParam[]).push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Data
              }
            })
          }
        }

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
      resume: sessionId,
    },
  });
  for await (const message of activeStream) {
    connectionManager.broadcast(message);
  }

  shouldContinueConversation = true;
}
