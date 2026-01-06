import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { createMCPClient } from "./mcp-client";
import { z } from 'zod'

export const FRONTIC_MCP_TOOLS = {
  LIST_RESOURCES: "mcp__fronticMcp__list_resources",
  LIST_PROJECTS: "mcp__fronticMcp__list_projects",
  DELETE_RESOURCE: "mcp__fronticMcp__delete_resource",
  FETCH_API_CALL: "mcp__fronticMcp__fetch_api_call",
  STORAGE_IDS: "mcp__fronticMcp__storage_ids",
  CREATE_BLOCK: "mcp__fronticMcp__create_block",
  CREATE_LISTING: "mcp__fronticMcp__create_listing",
  CREATE_PAGE: "mcp__fronticMcp__create_page",
  MANAGE_PAGE: "mcp__fronticMcp__manage_page",
  MANAGE_BLOCK: "mcp__fronticMcp__manage_block",
  MANAGE_LISTING: "mcp__fronticMcp__manage_listing"
}

// Disable SSL certificate verification for local development
// ONLY use this for testing with self-signed certificates!
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const mcpClient = await createMCPClient('https://mcp.frontstack.test/sse', '// Replace with valid Admin API token')

const fronticMcp = createSdkMcpServer({
  name: "fronticMcp",
  version: "0.0.1",
  tools: [
    tool(
      "list_projects",
      "List all projects",
      {},
      async (args) => {
        return await mcpClient.callTool({
          name: 'list_projects',
          arguments: {}
        })
      }
    ),
    tool(
      "list_resources",
      'Retrieve Frontstack Commerce entities within a specific project. Specify projectId to list blocks (reusable content components), pages (website pages), or storages within that project. Use mode "content" to retrieve the actual entity data, "resource" to retrieve the resource URIs.',
      {
        type: z
          .enum(['blocks', 'listings', 'pages', 'storages'])
          .describe(
            'Resource type: "blocks" lists content components, "listings" lists content lists, "pages" lists website pages, "storages" lists data storages'
          ),
        projectId: z
          .string()
          .describe(
            'Required. The unique identifier of the project to list entities from'
          ),
        mode: z
          .enum(['resource', 'content'])
          .optional()
          .default('content')
          .describe(
            'Mode: "resource" returns resource URIs (default), "content" returns actual entity data directly'
          )
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'list_resources',
          arguments: args
        })
      }
    ),
    tool(
      "delete_resource",
      'Delete a Frontstack Commerce resource by providing the project ID, resource type, and resource ID. Supports deleting blocks (reusable content components), listings, pages (website pages), and storage.',
      {
        projectId: z
          .string()
          .describe('The unique identifier of the project containing the resource to delete'),
        type: z
          .enum(['block', 'listing', 'page', 'storage'])
          .describe('Entity type: "block" for content components, "listing" for listings, "page" for website pages, "storage" for data storages'),
        id: z
          .string()
          .describe('The unique identifier of the specific resource to delete')
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'delete_resource',
          arguments: args
        })
      }
    ),
    tool(
      "fetch_api_call",
      'Get an exemplary Fetch API response for a given resource (block, listing or page). Useful for understanding the content of the response that the frontend will receive.',
      {
        type: z
          .enum(['block', 'listing', 'page'])
          .describe('Resource type to get the example for. Can be "block", "listing" or "page".'),
        projectId: z
          .string()
          .describe('Project ID in which the resource exists.'),
        name: z
          .string()
          .optional()
          .describe('The technical name of the block or listing in camel case - e.g. "ProductCard" or "CategoryListing". For pages it is ignored.'),
        parameters: z
          .string()
          .optional()
          .describe('JSON object containing the parameters for the resource (e.g. { "key": "<some-random-uuid>" }).'),
        slug: z
          .string()
          .optional()
          .describe('Only required for pages. The full URL of the page - e.g. "myshop.com/shoes/sneakers/nike-air-max-90"')
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'fetch_api_call',
          arguments: args
        })
      }
    ),
    tool(
      "storage_ids",
      'Get a list of IDs, slugs, keys for a given project and storage. Useful to use real record IDs as entry points for blocks, listings or pages.',
      {
        storageId: z
          .string()
          .describe('ID of the storage to get the records identifiers for'),
        projectedColumn: z
          .string()
          .describe('Which column represents the ID - for blocks it\'s always "key". For listings it depends on the configuration of parameters.'),
        projectId: z
          .string()
          .describe('Project ID in which the resource exists.')
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'storage_ids',
          arguments: args
        })
      }
    ),
    tool(
      "create_block",
      'Create a Frontstack block (for listings use the create_listing tool). Requires projectId to specify which project the block belongs to.',
      {
        projectId: z
          .string()
          .describe('The unique identifier of the project in which the block should be created'),
        name: z
          .string()
          .describe('The name of the block'),
        description: z
          .string()
          .describe('The description of the block. This should describe the purpose of the block in just a few words.'),
        storageId: z
          .string()
          .uuid()
          .describe('Must reference a valid storage ID from the available storages.'),
        useVariants: z
          .boolean()
          .optional()
          .default(false)
          .describe('If the storage used in storageId is of type "commerce", you can choose to retrieve product variants from this block.')
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'create_block',
          arguments: args
        })
      }
    ),
    tool(
      "create_listing",
      'Create a Frontstack listing (for blocks use the create_block tool). Requires projectId to specify which project the listing belongs to.',
      {
        projectId: z
          .string()
          .describe('The unique identifier of the project in which the listing should be created'),
        name: z
          .string()
          .describe('The name of the listing'),
        description: z
          .string()
          .describe('The description of the listing. This should describe the purpose of the listing in just a few words.'),
        storageId: z
          .string()
          .uuid()
          .describe('Must reference a valid storage ID from the available storages.'),
        resultStrategy: z
          .enum(['all', 'first'])
          .describe('Choose if the listing should return only the first result or all results. Use "first" for single item searches, "all" for listing multiple items.'),
        nestedBlockId: z
          .string()
          .uuid()
          .describe('Must reference a valid block ID from the available frontstack blocks. This block will be used to render each item in the listing.')
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'create_listing',
          arguments: args
        })
      }
    ),
    tool(
      "create_page",
      'Create a Frontstack page. A page generates URLs from block data records. Requires projectId, blockId (the listing or block to generate pages from), and field IDs for the URL slug and conflict resolution.',
      {
        projectId: z
          .string()
          .describe('The unique identifier of the project in which the page should be created'),
        name: z
          .string()
          .describe('The name of the page (max 100 characters)'),
        blockId: z
          .string()
          .uuid()
          .describe('Must reference a valid block ID from the available frontstack blocks. This must be a block, not a listing.'),
        slugBlockFieldId: z
          .string()
          .uuid()
          .describe('The ID of the block field to use as the URL slug.'),
        slugBlockFieldPath: z
          .string()
          .optional()
          .describe('The path in the slug block field, if it is a composite field (e.g., "label" for "cover.label"). Leave empty for simple fields.'),
        urlConflictStrategy: z
          .enum(['suffix', 'discard'])
          .optional()
          .describe('Strategy for handling URL conflicts: "suffix" adds the conflict suffix to make URLs unique, "discard" skips records with conflicting URLs.'),
        urlConflictSuffixBlockFieldId: z
          .string()
          .uuid()
          .optional()
          .describe('Only required for urlConflictStrategy="suffix". The ID of the block field to use as suffix when URL conflicts occur.'),
        urlConflictSuffixBlockFieldPath: z
          .string()
          .optional()
          .describe('Only relevant for urlConflictStrategy="suffix". The path in the URL conflict suffix block field, if it is a composite field.'),
        pageRecordDeleteStrategy: z
          .enum(['temporaryRedirect', 'permanentRedirect', 'notFound', 'delete'])
          .optional()
          .describe('Behavior when a source record is deleted: "temporaryRedirect" (302), "permanentRedirect" (301), "notFound" (404), or "delete" (removes the page URL completely).')
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'create_page',
          arguments: args
        })
      }
    ),
    tool(
      "manage_page",
      'Update an existing Frontstack page configuration. Only specify the fields you want to change. Note: You cannot change the page name or target block.',
      {
        projectId: z
          .string()
          .describe('The unique identifier of the project containing the page'),
        pageId: z
          .string()
          .uuid()
          .describe('The unique identifier of the page to update'),
        slugBlockFieldId: z
          .string()
          .uuid()
          .optional()
          .describe('Optional: The ID of the block field to use as the URL slug. Only provide if you want to change it.'),
        slugBlockFieldPath: z
          .string()
          .optional()
          .describe('Optional: The path in the slug block field, if it is a composite field. Use empty string "" for simple fields.'),
        urlConflictSuffixBlockFieldId: z
          .string()
          .uuid()
          .optional()
          .describe('Optional: The ID of the block field to use as suffix when URL conflicts occur. Required if you set urlConflictStrategy to "suffix".'),
        urlConflictSuffixBlockFieldPath: z
          .string()
          .optional()
          .describe('Optional: The path in the URL conflict suffix block field, if it is a composite field.'),
        urlConflictStrategy: z
          .enum(['suffix', 'discard'])
          .nullable()
          .optional()
          .describe('Optional: Strategy for handling URL conflicts. Set to null to clear the value. If set to "suffix", you must also provide urlConflictSuffixBlockFieldId.'),
        pageRecordDeleteStrategy: z
          .enum(['temporaryRedirect', 'permanentRedirect', 'notFound', 'delete'])
          .nullable()
          .optional()
          .describe('Optional: Behavior when a source record is deleted. Set to null to clear the value.')
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'manage_page',
          arguments: args
        })
      }
    ),
    tool(
      "manage_block",
      'Manage an existing Frontstack block: add or delete fields, and control the block\'s active status. Supports all field types: storage fields, nested blocks, result lists, page routes and product prices.',
      {
        projectId: z
          .string()
          .describe('The unique identifier of the project containing the block'),
        blockId: z
          .string()
          .uuid()
          .describe('The unique identifier of the block to modify'),
        fields: z
          .array(z.object({
            operation: z
              .enum(['add', 'delete'])
              .describe('The operation for this field: "add" to add a new field, "delete" to remove an existing field'),
            name: z
              .string()
              .describe('Name of the block field. For "add" operation, this will be the new field name. For "delete" operation, this must match an existing field name.'),
            fieldType: z
              .enum(['field', 'block', 'resultList', 'variantList', 'productPrice', 'pageRoute'])
              .optional()
              .describe('The type of field to add. Required for "add" operations.'),
            storageFieldId: z
              .string()
              .uuid()
              .optional()
              .describe('Required for fieldType="field". The ID of the field from the block\'s storage to link to.'),
            nestedBlockId: z
              .string()
              .uuid()
              .optional()
              .describe('Required for fieldType="block", "resultList", or "variantList". The ID of the nested block to embed.'),
            blockParameterValues: z
              .array(z.object({
                blockFieldId: z.string().uuid().describe('The ID of the block field to pass as value'),
                source: z.enum(['blockField', 'static', 'storageSchemaField']).describe('The source type for the block parameter value'),
                reference: z.string().describe('The static value or block field ID or storage field ID for the block parameter value source'),
                path: z.string().optional().describe('The path in the block field or storage field, if it is a composite field')
              }))
              .optional()
              .describe('Optional parameter values for nested blocks. Maps parent block fields to nested block parameters.'),
            priceStrategy: z
              .enum(['first', 'lowest', 'highest'])
              .optional()
              .describe('Required for fieldType="productPrice". Strategy for selecting price from variants.'),
            pageId: z
              .string()
              .uuid()
              .optional()
              .describe('Required for fieldType="pageRoute". The ID of the target page to link to.'),
            pageKeyBlockFieldId: z
              .string()
              .uuid()
              .optional()
              .describe('Required for fieldType="pageRoute". The ID of the block field that provides the key value.'),
            pageKeyStorageSchemaFieldId: z
              .string()
              .uuid()
              .optional()
              .describe('Required for fieldType="pageRoute". The ID of the storage schema field used as the page key.'),
            pageKeyPath: z
              .string()
              .optional()
              .describe('Optional for fieldType="pageRoute". Path in the key field if it is a composite field.')
          }))
          .optional()
          .describe('Optional array of field operations. Each field can have "add" or "delete" operation.'),
        active: z
          .boolean()
          .optional()
          .describe('Optional. Set whether the block is active (enabled) or inactive (disabled).')
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'manage_block',
          arguments: args
        })
      }
    ),
    tool(
      "manage_listing",
      'Manage all aspects of an existing Frontstack listing: search/filter/sort fields, parameters, query conditions, search settings (fuzzy search), and pagination settings (items per page).',
      {
        projectId: z
          .string()
          .describe('The unique identifier of the project containing the listing'),
        listingId: z
          .string()
          .uuid()
          .describe('The unique identifier of the listing to modify'),
        fields: z
          .array(z.object({
            operation: z
              .enum(['add', 'update', 'delete'])
              .describe('The operation for this field: "add", "update", or "delete"'),
            type: z
              .enum(['search', 'filter', 'sort'])
              .describe('The type of field: "search" for text search, "filter" for filtering/faceting, "sort" for sorting'),
            name: z
              .string()
              .describe('Name of the field. For "add" operation, this will be the new field name. For "update" and "delete" operations, this must match an existing field name.'),
            source: z
              .enum(['blockField', 'storageField'])
              .optional()
              .describe('Required for "add" operations. Source of the field: "blockField" or "storageField". Always prefer block fields over storage fields.'),
            path: z
              .string()
              .optional()
              .describe('Optional path of the field, if it is nested/composite'),
            isFacetted: z
              .boolean()
              .optional()
              .describe('Required for type="filter" add operations. Whether the filter field is facetted.'),
            isAggregated: z
              .boolean()
              .optional()
              .describe('Optional for type="filter" add operations. Whether to aggregate values for this filter field.'),
            ranges: z
              .array(z.object({
                from: z.number().describe('Start of the range'),
                to: z.number().describe('End of the range')
              }))
              .optional()
              .describe('Optional for type="filter". Numeric ranges for the filter field'),
            sort: z
              .enum(['asc', 'desc'])
              .optional()
              .describe('Required for type="sort" add operations. The sorting direction.'),
            isDefault: z
              .boolean()
              .optional()
              .describe('Required for type="sort" add operations. Indicates if this is the default sort field.')
          }))
          .optional()
          .describe('Optional array of field operations for search/filter/sort fields.'),
        parameters: z
          .array(z.object({
            operation: z
              .enum(['add', 'update', 'delete'])
              .describe('The operation for this parameter'),
            name: z
              .string()
              .describe('Name of the parameter'),
            dataType: z
              .string()
              .optional()
              .describe('Required for "add" operations. The data type of the parameter'),
            required: z
              .boolean()
              .optional()
              .describe('Required for "add" operations. Whether the parameter is required'),
            isArray: z
              .boolean()
              .optional()
              .describe('Required for "add" operations. Whether the parameter is an array'),
            minItems: z
              .number()
              .optional()
              .describe('Optional minimum number of items (for array parameters)'),
            maxItems: z
              .number()
              .optional()
              .describe('Optional maximum number of items (for array parameters)'),
            defaultValue: z
              .string()
              .optional()
              .describe('Optional default value for the parameter')
          }))
          .optional()
          .describe('Optional array of parameter operations. Parameters can be referenced in query conditions.'),
        conditions: z
          .array(z.object({
            operation: z
              .enum(['add', 'delete'])
              .describe('The operation for this condition'),
            index: z
              .number()
              .optional()
              .describe('Required for "delete" operation. The index of the condition to delete (0-based)'),
            before: z
              .object({
                type: z.enum(['blockField', 'storageField']).describe('Source type'),
                reference: z.string().describe('UUID of the field to compare'),
                path: z.string().optional().describe('Optional path if the field is composite')
              })
              .optional()
              .describe('Required for simple comparison conditions. The left-hand side of the condition.'),
            operator: z
              .enum(['like', 'notLike', 'equals', 'notEquals', 'gt', 'gte', 'lt', 'lte'])
              .optional()
              .describe('Required for simple comparison conditions. The comparison operator.'),
            after: z
              .object({
                type: z.enum(['blockParameter', 'value']).describe('Value type'),
                reference: z.string().describe('For blockParameter: parameter name. For value: the static value')
              })
              .optional()
              .describe('Required for simple comparison conditions. The right-hand side of the condition.'),
            rules: z
              .array(z.any())
              .optional()
              .describe('Array of nested conditions for complex AND/OR logic.'),
            group: z
              .enum(['and', 'or'])
              .optional()
              .describe('Required when rules are present. Logical operator for combining nested rules.')
          }))
          .optional()
          .describe('Optional array of query condition operations.'),
        isSearchFuzzy: z
          .boolean()
          .optional()
          .describe('Optional. Enable fuzzy search for better matching of similar terms.'),
        perPageDefault: z
          .number()
          .min(1)
          .optional()
          .describe('Optional. Default number of items per page for pagination.'),
        perPageMax: z
          .number()
          .min(1)
          .optional()
          .describe('Optional. Maximum number of items per page that can be requested.'),
        active: z
          .boolean()
          .optional()
          .describe('Optional. Set whether the listing is active (enabled) or inactive (disabled).')
      },
      async (args) => {
        return await mcpClient.callTool({
          name: 'manage_listing',
          arguments: args
        })
      }
    )
  ]
})

export default fronticMcp
