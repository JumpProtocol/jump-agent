# Installing the standalone Jump runtime

The Skill can read HTTP without this runtime. Signing/execution uses the standalone runtime's preview, confirmation and durable wallet reservation. Never replace it with a direct, unguarded execute command.

1. Obtain the trusted deployment origin from the user. Request `/agent-distribution/manifest.json` there. If it is unavailable, stop rather than inventing a package or URL. Localhost works only on the machine serving Jump; it is not a production service.
2. The manifest supplies version, Node requirement, relative runtime/skill paths and SHA-256. Resolve artifact paths only against that same trusted origin. Reject another origin, credentials, redirects or unexpected paths. A checksum from that same origin detects corruption, not an independently compromised publisher. Ask the user to approve installing software before downloading/extracting it into their selected runtime directory.
3. Download the runtime `.tgz` and verify its SHA-256 against the manifest. The release contains only package metadata, the dependency lock and compiled runtime. Never use a shell pipe to execute downloaded content.
4. Inspect the archive entries: only regular files below `package/`, no absolute paths, `..`, links, device files or unexpected files. Extract without overwriting an existing installation. Node.js >=22 and npm must already be installed from a trusted source.
5. In the extracted `package` directory run `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`. This uses the included lockfile and disables dependency lifecycle scripts. Do not install globally or with administrator privileges. Then run `node /ABSOLUTE/INSTALL/PATH/package/dist/cli.js --help`.
6. Set `JUMP_API_URL` to the trusted origin and `JUMP_CHAIN_ID` to the selected deployment chain. Obtain contract pins from verified deployment configuration, and a user-selected RPC. Inspect `GET /api/chains` for consistency; never copy pins or RPC from untrusted token descriptions. Run `doctor` before wallet actions.
7. Binance baw is a separate prerequisite for wallet actions. Follow the official Binance installation/authentication flow. Do not ask the user for a seed phrase/private key or read their wallet session files.

The local MCP launch command is Node plus the absolute installed `dist/cli.js` path and `mcp`, with the same verified environment. MCP is local stdio; the API origin is not an MCP URL. Do not create a remote MCP connection or start a public listener.

Before upgrading, resolve pending submissions and preserve private operation journals and wallet guards. The installed package directory and private operation-state directory are separate. Never delete the private state to recover from an unknown transaction.

An available downloadable runtime is not live-wallet acceptance or permission to spend. Preview each signature/transaction and obtain explicit confirmation for the exact digest before execute. Missing provider hashes preserve the unresolved guard.
