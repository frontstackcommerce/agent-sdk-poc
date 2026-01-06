import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/**
 * MCP Client manager for handling tool calls
 */
export class MCPClientManager {
  private client: Client | null = null
  private isConnected = false

  constructor(
    private config: {
      url: string
      headers: Record<string, string>
    }
  ) {}

  /**
   * Initialize and connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return
    }

    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(this.config.url),
        {
          requestInit: {
            headers: this.config.headers
          }
        }
      )

      this.client = new Client({
        name: 'studio-client',
        version: '1.0.0'
      })

      await this.client.connect(transport)
      this.isConnected = true
      console.log('MCP client connected successfully')
    } catch (error) {
      console.warn('Failed to connect MCP client:', error)
      this.client = null
      this.isConnected = false
      throw error
    }
  }

  /**
   * Get available tools from the MCP server
   */
  async getTools(): Promise<any[]> {
    if (!this.client || !this.isConnected) {
      await this.connect()
    }

    if (!this.client) {
      throw new Error('MCP client not available')
    }

    try {
      const response = await this.client.listTools()
      console.log(`Found ${response.tools.length} MCP tools`)
      return response.tools
    } catch (error) {
      console.warn('Failed to get MCP tools:', error)
      return []
    }
  }

  /**
   * Execute a tool call
   */
  async callTool(toolCall: {
    name: string
    arguments: any
  }): Promise<{ content: any; isError?: boolean }> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected')
    }

    try {
      console.log('Executing tool call:', toolCall.name, toolCall.arguments)
      const result = await this.client.callTool({
        name: toolCall.name,
        arguments: toolCall.arguments
      })

      console.log('Tool call result:', result)
      return {
        content: result.content,
        isError: Boolean(result.isError)
      }
    } catch (error) {
      console.error('Tool call failed:', error)
      return {
        content: `Tool call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true
      }
    }
  }

  /**
   * Close the MCP connection
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.close()
        console.log('MCP client disconnected')
      } catch (error) {
        console.warn('Error disconnecting MCP client:', error)
      } finally {
        this.client = null
        this.isConnected = false
      }
    }
  }

  /**
   * Check if the client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected && this.client !== null
  }
}

/**
 * Create and configure an MCP client manager
 */
export async function createMCPClient(
  url: string,
  accessToken: string
): Promise<MCPClientManager> {
  const manager = new MCPClientManager({
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  await manager.connect()
  return manager
}
