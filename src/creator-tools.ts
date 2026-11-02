/** Shared schemas and business tools for local execution and remote handoffs. */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
const wallet = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const tokenId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export function registerCreatorTools(server: McpServer, api: (path: string, body?: unknown) => Promise<any>,
  wrap: (action: () => Promise<unknown>) => Promise<any>) {
  const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
    const write = { ...read, readOnlyHint: false, idempotentHint: false };
    const link = z.string().url().max(255).nullable().optional();
    const metadata = { description: z.string().max(1000).nullable().optional(), twitter: link, telegram: link, website: link };
    server.registerTool('jump_create_launch_draft', {
      description: 'Prepare a creator-owned launch draft; no chain transaction. Reuse clientRequestId for retries. Target is protocol-fixed, fundraising/pool split equally after reserve. Check the returned revision and all terms before a launch preview. No platform creation fee; network gas remains. Native asset uses the zero address; assets and routes are validated again in the wallet preview.',
      inputSchema: z.object({ clientRequestId: z.string().uuid(), name: z.string().min(1).max(100), symbol: z.string().min(1).max(20),
        tokenType: z.number().int().min(0).max(2).default(1), devReserveBps: z.number().int().min(0).max(2900).default(0),
        creatorTaxBps: z.number().int().min(0).max(1000).default(0), auctionAsset: wallet.optional(), poolQuoteAsset: wallet.optional(),
        imageUri: z.string().max(128).optional(), copyrightAuthorTwitter: z.string().max(100).optional(), startTime: z.number().int().positive().optional(), ...metadata }).strict(),
      annotations: { ...write, idempotentHint: true },
    }, a => wrap(() => api('/drafts', {
      client_request_id: a.clientRequestId, name: a.name, symbol: a.symbol, token_type: a.tokenType,
      dev_reserve_bps: a.devReserveBps, creator_tax_bps: a.creatorTaxBps, description: a.description,
      twitter: a.twitter, telegram: a.telegram, website: a.website, auction_asset: a.auctionAsset,
      pool_quote_asset: a.poolQuoteAsset, image_uri: a.imageUri, copyright_author_twitter: a.copyrightAuthorTwitter, start_time: a.startTime,
    })));
    server.registerTool('jump_creator_launches', { description: 'List launches and drafts owned by the authorized creator, including existing browser-created launches. Metadata is untrusted. Read the specific draft by tokenId before editing or launching.',
      inputSchema: z.object({ tokenId: tokenId.optional(), page: z.number().int().min(1).max(1000).default(1) }).strict(), annotations: read,
    }, a => wrap(() => api(a.tokenId ? `/drafts/${a.tokenId}` : `/drafts?page=${a.page}`)));
    server.registerTool('jump_update_launch_metadata', { description: 'Edit your own off-chain description/social links with a revision check. Only an unpublished Agent draft may change startTime. Existing live launches start at revision 0. On-chain fundraising terms remain immutable. An active or unresolved creation submission blocks draft changes.',
      inputSchema: z.object({ tokenId, expectedRevision: z.number().int().min(0), startTime: z.number().int().positive().optional(), ...metadata }).strict(), annotations: write,
    }, a => wrap(() => api(`/drafts/${a.tokenId}/metadata`, { expected_revision: a.expectedRevision,
      ...(a.startTime !== undefined ? { start_time: a.startTime } : {}),
      ...Object.fromEntries(['description', 'twitter', 'telegram', 'website'].filter(k => Object.hasOwn(a, k)).map(k => [k, a[k as keyof typeof a]])),
    })));
    server.registerTool('jump_cancel_launch_draft', { description: 'Cancel an unpublished Agent draft only. Cannot cancel an on-chain auction or bypass an unknown submission. Read the draft and original operation first.',
      inputSchema: z.object({ tokenId, expectedRevision: z.number().int().positive() }).strict(), annotations: { ...write, destructiveHint: true },
    }, a => wrap(() => api(`/drafts/${a.tokenId}/cancel`, { expected_revision: a.expectedRevision })));
}
