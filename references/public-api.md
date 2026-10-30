# Public HTTP API

Use the user-selected trusted HTTPS origin as the base. Interpret `{code,data,msg}`: only `code=0` is success, including when HTTP status is 200. Requests must have bounded timeout/size and must not forward credentials on redirects.

- `GET /api/agent/v1/capabilities`: versioned discovery, active chain/environment, supported preparation actions and boundaries. Paths are relative to this origin. No private RPC or wallet credentials are included.
- `GET /api/chains`: public contract/asset configuration, excluding private RPC URLs.
- `GET /api/tokens?chain_id=CHAIN&page=1`: public launch discovery. Token database ID differs from on-chain launchId.
- `GET /api/tokens/ID/auction/agent?chain_id=CHAIN`: indexed phase, actual FDV, cap, oversubscription and wallets-at-cap count. Optional `wallet=ADDRESS&additional_amount=DECIMAL` invokes the shared canonical allocation estimate. `max_lag_blocks=null` means no one-block freshness guarantee.
- `GET /api/portfolio/ADDRESS/agent-activity?chain_id=CHAIN&page=1`: bounded indexed contribution history and pending participation. It does not prove Agent identity, and does not contain a complete claim/refund event ledger.
- `POST /api/auth/agent/challenge` with `wallet_address,chain_id`: server-owned EIP-712 login challenge; inspect its purpose, audience, wallet, chain and expiry. This is authentication only.
- `POST /api/auth/agent/login` with `challenge_id,signature`: verifies and consumes that challenge once, then returns a short-lived bearer token. Keep it private, scoped to this origin/chain/wallet. Never send it to token websites or put it in a URL.
- `POST /api/agent/v1/plans` with `chain_id,token_id,action` and optional decimal `amount`: authenticated unsigned preparation only. Use an Agent EIP-712 JWT for the exact chain/wallet. The server chooses the target and calldata and rechecks deployment/state/balance/gas. There is no wallet field, arbitrary target, arbitrary message, RPC URL or calldata input. No signature or broadcast occurs. The response is a short-lived inspection result, not an execution authorization or a durable submission record.

Preparation actions: `deposit`, `withdraw`, `claim`, `cancelled-refund`, `deferred-refund`. Only deposit/withdraw take amount; claim needs an available canonical allocation proof. Check the deployment capability flag before requesting a plan. A plan's digest does not approve anything. Use the installed runtime to create its own fresh provider preview and durable execution guard; do not directly broadcast an old HTTP plan or bypass the runtime's unresolved submission lock.

Website `/api/agent-wallet/*` is a separate browser-cookie session with Origin checks. Do not reuse its cookies or treat it as a public remote signer. Launch creation, staking, secondary trading, .ai resolution and automatic scheduling are outside this first integration.
