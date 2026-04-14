# Rootstock Dev Copilot

AI-powered developer interface for Rootstock that converts plain-English prompts into structured MCP workflows.  
The project ships CLI-first, with a VS Code extension surface using the same shared orchestration core.

## What it does

- Query chain data with natural language.
- Simulate transactions using eth_call-style planning and execution.
- Inspect decoded bridge events with checkpointed cursor state.
- Return typed execution envelopes (`requestId`, `success`, `data/error`) for reliable automation.

## Key capabilities

- **Natural language engine** with optional OpenAI/Anthropic provider integration and deterministic fallback.
- **MCP adapter** with `mock` and `http` modes, timeout, retry, normalization, and validation.
- **Operational quality gates** with lint, typecheck, tests, smoke checks, and runtime readiness checks.
- **Dual surfaces**: CLI + VS Code command integration.

## Monorepo structure

- `apps/cli`: CLI entrypoint.
- `apps/vscode`: VS Code extension command.
- `packages/core`: shared types and zod schemas.
- `packages/llm`: prompt-to-intent logic.
- `packages/mcp-adapter`: MCP transport and validation layer.
- `packages/orchestrator`: intent -> plan -> execution flow.
- `packages/config`: runtime env validation.
- `packages/bridge-state`: bridge cursor persistence.
- `packages/observability`: structured JSON logging.
- `scripts`: smoke, readiness, and integration proof scripts.

## Quick start

```bash
npm install
npm run dev -- "show me the last 5 peg-in transactions on testnet"
npm run dev -- "simulate tx on testnet from 0x0000000000000000000000000000000000000001 to 0x0000000000000000000000000000000000000002 data 0xabcdef"
npm run dev -- "show me last 5 bridge events on testnet"
```

## Environment

### MCP transport

```env
RSK_MCP_TRANSPORT=mock
RSK_MCP_TIMEOUT_MS=10000
RSK_MCP_RETRIES=2
```

Live mode:

```env
RSK_MCP_TRANSPORT=http
RSK_MCP_URL=https://your-mcp-host
RSK_MCP_API_KEY=optional-token
RSK_MCP_TIMEOUT_MS=10000
RSK_MCP_RETRIES=2
```

### LLM provider (optional)

OpenAI:

```env
RSK_LLM_PROVIDER=openai
RSK_LLM_API_KEY=your-openai-key
RSK_LLM_MODEL=gpt-4.1-mini
# Optional:
# RSK_LLM_BASE_URL=https://api.openai.com/v1/chat/completions
```

Anthropic:

```env
RSK_LLM_PROVIDER=anthropic
RSK_LLM_API_KEY=your-anthropic-key
RSK_LLM_MODEL=claude-3-5-sonnet-latest
# Optional:
# RSK_LLM_BASE_URL=https://api.anthropic.com/v1/messages
```

## Commands

- `npm run dev -- "<prompt>"`: run CLI flow.
- `npm run dev:vscode`: run VS Code extension entry.
- `npm run lint`: lint all workspaces.
- `npm run typecheck`: run TypeScript checks.
- `npm run test`: run tests.
- `npm run smoke`: run smoke scenarios.
- `npm run live:readiness`: runtime orchestration checks (current env).
- `npm run verify:prod`: lint + typecheck + tests + smoke.
- `npm run ready`: full gate (`verify:prod` + `live:readiness`).
- `npm run proof:rsk-mcp`: official Rootstock MCP integration proof script.

## Official Rootstock MCP proof

Run:

```bash
npm run proof:rsk-mcp
```

What it does:

- launches official `@rsksmart/rsk-mcp-server` over MCP stdio,
- attempts handshake and tool introspection,
- verifies expected official tool names when handshake succeeds.

In our current local environment, the official package may exit before handshake due to upstream runtime compatibility. We still provide package-resolution proof and strict mode (`RSK_OFFICIAL_PROOF_STRICT=true`) for deterministic validation in compatible environments.

Strict mode:

```bash
RSK_OFFICIAL_PROOF_STRICT=true npm run proof:rsk-mcp
```

Optional command overrides:

```bash
RSK_OFFICIAL_MCP_COMMAND=npx \
RSK_OFFICIAL_MCP_ARGS="-y @rsksmart/rsk-mcp-server" \
npm run proof:rsk-mcp
```

## Output mode

Default output:

```bash
npm run dev -- "show me last 3 bridge events on testnet"
```

JSON output:

```bash
npm run dev -- --json "show me last 3 bridge events on testnet"
```

## Runtime state and logs

- Cursor state file: `.state/bridge-cursor.json`
- Structured logs: JSON lines on stdout/stderr from orchestrator

## VS Code extension

After loading extension artifacts, run command palette action:

- `RSK MCP: Run Natural Language Query`

Optional visual assets:

- `docs/assets/vscode-command-palette.png`
- `docs/assets/vscode-query-result.png`
- `docs/assets/vscode-demo.gif`

## Docker

```bash
docker build -t rsk-mcp-dev-client .
docker run --rm --env-file .env.example rsk-mcp-dev-client
```

## Release checklist

- `npm run ready` passes.
- For live claims, run with `RSK_MCP_TRANSPORT=http` and real `RSK_MCP_URL`.
- Provide `npm run proof:rsk-mcp` output as integration evidence.

