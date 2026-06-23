// MCP tool registry for the Keystone server.
//
// Each tool declares a JSON Schema for its inputs (so MCP clients like Claude
// Code can call them correctly) and a handler that delegates to the
// ownership-checked operations in ./site-ops. Handlers return plain JSON; the
// protocol layer wraps the result as MCP text content.

import {
  AI_BLOCK_CAPABILITIES,
  AI_SUPPORTED_BLOCK_TYPES,
} from '@/lib/ai/block-capabilities';
import {
  McpToolError,
  addBlock,
  createPage,
  createSite,
  deletePage,
  duplicateSiteForUser,
  getPage,
  getSite,
  listSites,
  removeBlock,
  setPageBlocks,
  setTheme,
  updateBlock,
} from '@/lib/mcp/site-ops';

export interface ToolContext {
  userId: string;
}

interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

// Reusable schema fragments.
const siteIdProp = { type: 'string', description: 'The site id (UUID) returned by list_sites or create_site.' };
const slugProp = { type: 'string', description: 'Page slug. Use "home" for the home page.' };
const blockArrayProp = {
  type: 'array',
  description: 'Ordered blocks. Each item is { type, data }. Call list_block_types / describe_block for valid types and fields.',
  items: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
    required: ['type'],
  },
};

const str = (s: string) => JSON.stringify(s);

export const TOOLS: McpTool[] = [
  {
    name: 'list_sites',
    description: 'List all websites owned by the authenticated user, with id, name, publish status and category.',
    inputSchema: { type: 'object', properties: {} },
    handler: (_args, ctx) => listSites(ctx.userId),
  },
  {
    name: 'get_site',
    description: 'Get one site: its theme (fonts/colors), template, publish status, and the list of pages with block counts.',
    inputSchema: { type: 'object', properties: { siteId: siteIdProp }, required: ['siteId'] },
    handler: (args, ctx) => getSite(ctx.userId, String(args.siteId)),
  },
  {
    name: 'get_page',
    description: 'Get the full ordered blocks of one page (each block has an id, type and data). Use "home" for the home page.',
    inputSchema: { type: 'object', properties: { siteId: siteIdProp, slug: slugProp }, required: ['siteId', 'slug'] },
    handler: (args, ctx) => getPage(ctx.userId, String(args.siteId), String(args.slug)),
  },
  {
    name: 'create_site',
    description: 'Create a new draft website owned by the user. Returns the new siteId. The site starts with an empty "home" page; add content with add_block / set_page_blocks.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Business / site name, e.g. "Acme Plumbing".' },
        businessType: { type: 'string', enum: ['services', 'products', 'both'], description: 'Defaults to "services".' },
        category: { type: 'string', description: 'Industry/category, e.g. "plumber". Defaults to "general".' },
        templateId: { type: 'string', description: 'Optional template id. Omit to use the flexible AI template.' },
      },
      required: ['name'],
    },
    handler: (args, ctx) =>
      createSite(ctx.userId, {
        name: String(args.name),
        businessType: args.businessType ? String(args.businessType) : undefined,
        category: args.category ? String(args.category) : undefined,
        templateId: args.templateId ? String(args.templateId) : undefined,
      }),
  },
  {
    name: 'duplicate_site',
    description: 'Clone an existing site (pages, blocks and content) into a new draft owned by the user.',
    inputSchema: {
      type: 'object',
      properties: { siteId: siteIdProp, newName: { type: 'string', description: 'Optional name for the copy.' } },
      required: ['siteId'],
    },
    handler: (args, ctx) => duplicateSiteForUser(ctx.userId, String(args.siteId), args.newName ? String(args.newName) : undefined),
  },
  {
    name: 'set_page_blocks',
    description: 'Replace ALL blocks on a page with the given ordered list. Existing blocks are discarded. Good for laying out a page in one call.',
    inputSchema: {
      type: 'object',
      properties: { siteId: siteIdProp, slug: slugProp, blocks: blockArrayProp },
      required: ['siteId', 'slug', 'blocks'],
    },
    handler: (args, ctx) =>
      setPageBlocks(ctx.userId, String(args.siteId), String(args.slug), (args.blocks as Array<{ type: string; data?: unknown }>) ?? []),
  },
  {
    name: 'add_block',
    description: 'Append (or insert at "index") a single block to a page. Returns the new block id.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: siteIdProp,
        slug: slugProp,
        type: { type: 'string', description: 'Block type. See list_block_types.' },
        data: { type: 'object', additionalProperties: true, description: 'Block content fields. See describe_block.' },
        index: { type: 'number', description: 'Optional 0-based insert position. Omit to append.' },
      },
      required: ['siteId', 'slug', 'type'],
    },
    handler: (args, ctx) =>
      addBlock(
        ctx.userId,
        String(args.siteId),
        String(args.slug),
        String(args.type),
        args.data,
        typeof args.index === 'number' ? args.index : undefined,
      ),
  },
  {
    name: 'update_block',
    description: 'Merge new field values into one existing block (identified by blockId). Only the fields you pass are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: siteIdProp,
        slug: slugProp,
        blockId: { type: 'string', description: 'Block id from get_page.' },
        data: { type: 'object', additionalProperties: true, description: 'Fields to merge into the block.' },
      },
      required: ['siteId', 'slug', 'blockId', 'data'],
    },
    handler: (args, ctx) => updateBlock(ctx.userId, String(args.siteId), String(args.slug), String(args.blockId), args.data),
  },
  {
    name: 'remove_block',
    description: 'Delete one block from a page by its blockId.',
    inputSchema: {
      type: 'object',
      properties: { siteId: siteIdProp, slug: slugProp, blockId: { type: 'string' } },
      required: ['siteId', 'slug', 'blockId'],
    },
    handler: (args, ctx) => removeBlock(ctx.userId, String(args.siteId), String(args.slug), String(args.blockId)),
  },
  {
    name: 'create_page',
    description: 'Add a new page to a site (slug must be lowercase-hyphenated, e.g. "about-us"). Optionally seed it with blocks and add it to the nav.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: siteIdProp,
        slug: { type: 'string', description: 'Lowercase letters, numbers and hyphens. Not "home".' },
        title: { type: 'string', description: 'Page title (browser/SEO). Defaults to the slug.' },
        displayName: { type: 'string', description: 'Label shown in navigation. Defaults to the title.' },
        visibleInNav: { type: 'boolean', description: 'Add to the site navigation. Defaults to true.' },
        blocks: blockArrayProp,
      },
      required: ['siteId', 'slug'],
    },
    handler: (args, ctx) =>
      createPage(ctx.userId, String(args.siteId), {
        slug: String(args.slug),
        title: args.title ? String(args.title) : undefined,
        displayName: args.displayName ? String(args.displayName) : undefined,
        visibleInNav: typeof args.visibleInNav === 'boolean' ? args.visibleInNav : undefined,
        blocks: (args.blocks as Array<{ type: string; data?: unknown }>) ?? undefined,
      }),
  },
  {
    name: 'delete_page',
    description: 'Delete a page (and its nav entry) from a site. The home page cannot be deleted.',
    inputSchema: {
      type: 'object',
      properties: { siteId: siteIdProp, slug: { type: 'string', description: 'Slug of the page to delete (not "home").' } },
      required: ['siteId', 'slug'],
    },
    handler: (args, ctx) => deletePage(ctx.userId, String(args.siteId), String(args.slug)),
  },
  {
    name: 'set_theme',
    description: 'Update site-wide theme: site title, heading/body fonts, and primary/secondary/accent colors (hex). Only the fields you pass change.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: siteIdProp,
        siteTitle: { type: 'string', description: 'Name shown in the site header/footer.' },
        headingFont: { type: 'string', description: 'Font family for headings.' },
        bodyFont: { type: 'string', description: 'Font family for body text.' },
        primaryColor: { type: 'string', description: 'Hex color, e.g. "#1a73e8".' },
        secondaryColor: { type: 'string', description: 'Hex color.' },
        accentColor: { type: 'string', description: 'Hex color.' },
      },
      required: ['siteId'],
    },
    handler: (args, ctx) =>
      setTheme(ctx.userId, String(args.siteId), {
        siteTitle: args.siteTitle ? String(args.siteTitle) : undefined,
        headingFont: args.headingFont ? String(args.headingFont) : undefined,
        bodyFont: args.bodyFont ? String(args.bodyFont) : undefined,
        primaryColor: args.primaryColor ? String(args.primaryColor) : undefined,
        secondaryColor: args.secondaryColor ? String(args.secondaryColor) : undefined,
        accentColor: args.accentColor ? String(args.accentColor) : undefined,
      }),
  },
  {
    name: 'list_block_types',
    description: 'List every supported block type with a one-line purpose. Call this before building a page so you choose valid block types.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () =>
      AI_BLOCK_CAPABILITIES.map((b) => ({ type: b.type, label: b.label, purpose: b.purpose })),
  },
  {
    name: 'describe_block',
    description: 'Get the editable fields (names, types, allowed values, defaults) and guidance for one block type, so you can fill its "data" correctly.',
    inputSchema: {
      type: 'object',
      properties: { type: { type: 'string', description: `One of: ${AI_SUPPORTED_BLOCK_TYPES.join(', ')}` } },
      required: ['type'],
    },
    handler: async (args) => {
      const type = String(args.type);
      const cap = AI_BLOCK_CAPABILITIES.find((b) => b.type === type);
      if (!cap) throw new McpToolError(`Unknown block type ${str(type)}. Call list_block_types for the full list.`);
      return cap;
    },
  },
];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
