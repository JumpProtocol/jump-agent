# Jump Agent · Preview

Official Skill and local MCP distribution channel for [Jump](https://app.jump.family/).

This repository is a public integration preview. Production Agent v1 API and transaction execution are not enabled at initial publication. Real wallet signing, approval, deposit, claim and refund acceptance remains pending. Never treat a successful local test, downloaded Skill, or connected QR as permission to spend.

## Install the Skill

Download `SKILL.md` from this repository and install it using your agent client's documented local Skill installation. The Skill is self-contained. No Jump source checkout is required for HTTP reads. If using a Skill installer, verify the repository is `JumpProtocol/jump-agent` and inspect the contents before installing.

## Local MCP

The MCP runtime runs locally with Node.js 22 or later and uses the separately installed official Binance `baw` CLI. A versioned, verified runtime archive will be published through GitHub Releases after the release gate passes. There is no published npm package or hosted MCP endpoint. Do not use an invented npm name, remote MCP URL, or repository-relative `agent/dist/cli.js` path.

## Safety

- Check the trusted HTTPS origin and `/api/agent/v1/capabilities` before starting. Missing or disabled endpoints stop execution.
- Money operations require scoped signed Agent login, a fresh exact preview, explicit user confirmation, shared server reservation and durable local state.
- Wallet keys remain with the wallet provider. Never share seed phrases, private keys, wallet sessions or API bearer tokens.
- Never scan a forwarded QR. A matching pairing code does not establish who controls the browser session.
- An unknown submission or missing transaction hash remains blocked. Never delete state or repeat execute to work around it.
- Human/Agent is an interaction view. A wallet or `.ai` lookup does not prove Agent identity or launch authorship.

## Release status

No production runtime release has been published. Local development artifacts are not a production release. Future releases must include immutable archives, SHA-256 checksums, installation checks and build provenance. Source platform changes and production deployment are reviewed separately; this repository contains no deployment secrets or operator credentials.

## Build and review the runtime source

The source in this repository is independently buildable and includes its tests and locked dependencies. With Node.js >=22 installed, run `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, then `npm run build`. The local MCP command is `node /ABSOLUTE/PATH/dist/cli.js --api https://app.jump.family --chain-id 56 mcp`. Startup alone grants no wallet access; production preparation and coordination must be deployed before any transaction can execute.

`npm run release:public` creates development artifacts under `release/`; `python3 scripts/verify-public-release.py` checks an isolated install. Formal candidate packaging requires a clean checkout at a matching version tag. CI records build provenance; public release publication remains a separate step.
