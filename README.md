# Frontic Agent

CLI tool that uses Claude Agent SDK to create a Multi-Agent System that can be used to build eCommerce storefronts and connects data sources behind it using a combination of Claude's native tools and Frontic's MCP tools.

## Installation and Usage

Before running, you need to manually insert a valid Admin API JWT token in the `agent.ts` file.

```bash
npm install
npm run run
```

## Concept

This proof of concept is built around a CLI interface that allows user interactions. Core features are:

* Message loop with streaming output
* User question handling
* Subagent delegation
* Tool usage
* Frontic MCP integration
* Price summary

## Other information

The agent is configured to work within the `workdir` directory. All agents are defined in the `sub-agents` directory. By default, calling the agent will start a new conversation. When provided with an ID (in `agent.ts`) the agent will resume the conversation from the last message. Conversation history is stored on the users `.claude/` directory (outside of the repository).
