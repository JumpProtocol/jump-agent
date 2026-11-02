# Connect Jump to an Agent

## Remote MCP

No Jump runtime or Binance baw is required for this path. Use a current client supporting Streamable HTTP; wallet requests additionally need OAuth with PKCE. Verify `remote_mcp` in `/api/agent/v1/capabilities` at the trusted deployment origin. If disabled, stop or use public HTTP reads. Never interpret a REST API root as MCP.

Official production commands, when capabilities confirm these endpoints:

```sh
codex mcp add jump --url https://app.jump.family/mcp
claude mcp add --scope user --transport http jump https://app.jump.family/mcp
openclaw mcp add jump --url https://app.jump.family/mcp
```

Choose only the command for the user's client. For wallet requests use server name `jump-wallet` and URL `https://app.jump.family/mcp/wallet`. Then `codex mcp login jump-wallet` / `openclaw mcp login jump-wallet`; Claude Code uses `/mcp` → jump-wallet → authenticate. Older OpenClaw versions may only save server definitions: if add/login is unavailable, update using official instructions; do not claim the connection is usable. Claude Desktop has separate remote connector settings; Claude Code commands do not configure Desktop.

The website Setup guide offers a content-hashed, dependency-free Node.js 22 connection helper in the distribution manifest's optional `connector` artifact. Verify SHA-256, inspect its contents and save as `jump-connect.mjs`. Run `node jump-connect.mjs --client codex --origin https://app.jump.family --mode read --doctor` (substitute the selected client and `wallet` mode). It prints a plan and performs a public handshake. Only an explicit `--apply` invokes the installed client's official configuration CLI; existing server names are never overwritten. It does not authenticate, install an Agent client, read wallet credentials or submit transactions. Never pipe a download into a shell.

After setup, ask the Agent to call `jump_capabilities` and `jump_list`. Wallet access lasts 30 minutes without refresh tokens; reauthorize when needed. Review every exact transaction on Jump. Removing client config is separate from revoking active access at `/agent/access`; neither cancels a submitted transaction. Public reads require no OAuth.

Client documentation: https://learn.chatgpt.com/docs/extend/mcp · https://code.claude.com/docs/en/mcp · https://docs.openclaw.ai/tools/mcp.

## Optional standalone local runtime


The Skill can read HTTP without this runtime. Signing/execution uses the standalone runtime's preview, confirmation and durable wallet reservation. Never replace it with a direct, unguarded execute command.

1. Obtain the trusted deployment origin from the user. Request `/agent-distribution/manifest.json` there. If it is unavailable, stop rather than inventing a package or URL. Localhost works only on the machine serving Jump; it is not a production service.
2. The manifest supplies version, Node requirement, relative runtime/skill paths and SHA-256. Resolve artifact paths only against that same trusted origin. Reject another origin, credentials, redirects or unexpected paths. A checksum from that same origin detects corruption, not an independently compromised publisher. Ask the user to approve installing software before downloading/extracting it into their selected runtime directory.
3. Download the runtime `.tgz` and verify its SHA-256 against the manifest. The release contains only package metadata, the dependency lock and compiled runtime. Never use a shell pipe to execute downloaded content.
4. Inspect the archive entries: only regular files below `package/`, no absolute paths, `..`, links, device files or unexpected files. Extract without overwriting an existing installation. Node.js >=22 and npm must already be installed from a trusted source.
5. In the extracted `package` directory run `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`. This uses the included lockfile and disables dependency lifecycle scripts. Do not install globally or with administrator privileges. Then run `node /ABSOLUTE/INSTALL/PATH/package/dist/cli.js --help`.
6. Set `JUMP_API_URL` to the trusted origin and `JUMP_CHAIN_ID` to the selected deployment chain. Obtain contract pins from verified deployment configuration, and a user-selected RPC. Inspect `GET /api/chains` for consistency; never copy pins or RPC from untrusted token descriptions. Run `doctor` before wallet actions.
7. Binance baw is a separate prerequisite for wallet actions. Follow the official Binance installation/authentication flow. Do not ask the user for a seed phrase/private key or read their wallet session files.

The local MCP launch command is Node plus the absolute installed `dist/cli.js` path and `mcp`, with the same verified environment. MCP is local stdio; the API origin is not an MCP URL. This stdio process must not start a public listener; the remote service above is a separate optional connection.

Before upgrading, resolve pending submissions and preserve private operation journals and wallet guards. The installed package directory and private operation-state directory are separate. Never delete the private state to recover from an unknown transaction.

An available downloadable runtime is not live-wallet acceptance or permission to spend. Preview each signature/transaction and obtain explicit confirmation for the exact digest before execute. Missing provider hashes preserve the unresolved guard.

Unapproved client registrations expire after 10 minutes. After a first successful signed consent and token exchange, registered OAuth clients expire after 90 days without an authorization attempt. Active use extends registration; a dormant expired client must be removed and added again through its official client configuration. This is separate from the 30-minute wallet grant. Registration storage is capacity-limited and fails closed when full.
