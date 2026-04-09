# RSK MCP Dev Client

Natural language developer client for Rootstock.  
This project lets developers query chain state, simulate transactions, and inspect PowPeg bridge activity using plain English instead of raw JSON-RPC.

## Why this exists

RSK development often depends on direct RPC calls and custom scripts, which increases friction and slows iteration.  
This client adds an AI orchestration layer on top of MCP so developers can stay in flow while still getting typed, validated, production-safe responses.

## Core capabilities

- **Natural language query engine**: converts prompts into structured intents and tool plans.
- **Provider-backed LLM parsing**: supports OpenAI/Anthropic intent extraction with deterministic fallback.
- **MCP adapter layer**: supports `mock` and `http` transport with retries, timeout, and normalized errors.
- **Transaction simulation**: supports simulation planning and execution with optional state override inputs.
- **Bridge event inspector**: retrieves decoded peg-in/peg-out style event streams with cursor checkpointing.
- **Production contracts**: all tool executions return a standardized execution envelope with `requestId`, `success`, and `data/error`.
- **Operational readiness**: lint, typecheck, tests, smoke tests, live-readiness checks, structured logs.

## Architecture

Monorepo layout:

- `apps/cli`: end-user CLI interface.
- `apps/vscode`: VS Code extension surface (command palette integration).
- `packages/core`: shared types and zod schemas.
- `packages/llm`: intent extraction from natural language.
- `packages/mcp-adapter`: MCP transport, retries, validation, envelopes.
- `packages/orchestrator`: intent -> plan -> execution pipeline.
- `packages/config`: runtime environment validation.
- `packages/bridge-state`: bridge cursor persistence.
- `packages/observability`: structured JSON logging.
- `scripts`: readiness and smoke scripts.

## Quick start

```bash
npm install
npm run dev -- "show me the last 5 peg-in transactions on testnet"
npm run dev -- "simulate tx on testnet from 0x0000000000000000000000000000000000000001 to 0x0000000000000000000000000000000000000002 data 0xabcdef"
npm run dev -- "show me last 5 bridge events on testnet"
```

## Demo script

Use this exact sequence for a live demo:

```bash
# 1) Prove engineering readiness
npm run ready

# 2) Query peg-ins
npm run dev -- "show me the last 5 peg-in transactions on testnet"

# 3) Simulate tx with state override
npm run dev -- "simulate tx on testnet from 0x0000000000000000000000000000000000000001 to 0x0000000000000000000000000000000000000002 data 0xabcdef override {\"0x0000000000000000000000000000000000000002\":{\"balance\":\"0x1\"}}"

# 4) Inspect bridge events
npm run dev -- "show me last 5 bridge events on testnet"

# 5) Show automation output mode
npm run dev -- --json "show me last 3 bridge events on testnet"
```

## Environment configuration

Use `.env` (or shell env vars) to configure transport.

### Mock mode (default for local dev)

```env
RSK_MCP_TRANSPORT=mock
RSK_MCP_TIMEOUT_MS=10000
RSK_MCP_RETRIES=2
```

### Live MCP mode

```env
RSK_MCP_TRANSPORT=http
RSK_MCP_URL=https://your-mcp-host
RSK_MCP_API_KEY=optional-token
RSK_MCP_TIMEOUT_MS=10000
RSK_MCP_RETRIES=2
```

### LLM provider configuration (optional but production-recommended)

```env
RSK_LLM_PROVIDER=openai
RSK_LLM_API_KEY=your-openai-key
RSK_LLM_MODEL=gpt-4.1-mini
# Optional custom endpoint:
# RSK_LLM_BASE_URL=https://api.openai.com/v1/chat/completions
```

Anthropic configuration:

```env
RSK_LLM_PROVIDER=anthropic
RSK_LLM_API_KEY=your-anthropic-key
RSK_LLM_MODEL=claude-3-5-sonnet-latest
# Optional custom endpoint:
# RSK_LLM_BASE_URL=https://api.anthropic.com/v1/messages
```

You can also pass CLI flags:

```bash
npm run dev -- --transport http --mcp-url "https://your-mcp-host" "show me the last 5 peg-in transactions on mainnet"
```

## Commands

- `npm run dev -- "<prompt>"`: run CLI prompt flow.
- `npm run dev:vscode`: run VS Code extension entry in development mode.
- `npm run lint`: lint all workspaces.
- `npm run typecheck`: run strict TypeScript checks.
- `npm run test`: run workspace tests.
- `npm run smoke`: run production smoke script.
- `npm run live:readiness`: run runtime orchestration checks using current env transport.
- `npm run verify:prod`: lint + typecheck + tests + smoke.
- `npm run ready`: complete production gate (`verify:prod` + `live:readiness`).

## Output modes

Human-readable output (default):

```bash
npm run dev -- "show me last 3 bridge events on testnet"
```

Machine-readable JSON output:

```bash
npm run dev -- --json "show me last 3 bridge events on testnet"
```

## Runtime state and logs

- Bridge cursor checkpoint file: `.state/bridge-cursor.json`
- Logs: JSON lines to stdout/stderr from orchestrator (`requestId`, action, event, metadata)

## CI and quality gates

GitHub Actions runs the production verification gate on push and PR:

- install dependencies
- `npm run verify:prod`

## VS Code extension usage

After packaging/loading the extension in VS Code, run command palette action:

- `RSK MCP: Run Natural Language Query`

## VS Code visuals

Add screenshots or GIFs under `docs/assets/` and link them here:

- `docs/assets/vscode-command-palette.png`
- `docs/assets/vscode-query-result.png`
- `docs/assets/vscode-demo.gif`

Suggested capture flow:
- open command palette
- run `RSK MCP: Run Natural Language Query`
- enter prompt
- show output channel response

## Docker

```bash
docker build -t rsk-mcp-dev-client .
docker run --rm --env-file .env.example rsk-mcp-dev-client
```

## Submission / release checklist

- `npm run ready` passes locally.
- For live claims, set `RSK_MCP_TRANSPORT=http` and a real `RSK_MCP_URL`, then rerun `npm run ready`.
- Confirm logs, cursor persistence, and auth configuration in deployment environment.

