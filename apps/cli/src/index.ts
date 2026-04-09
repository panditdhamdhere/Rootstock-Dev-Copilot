#!/usr/bin/env node
import { Command } from 'commander';
import { loadRuntimeConfig } from '@rsk/config';
import { Orchestrator } from '@rsk/orchestrator';
import type { McpTransportMode } from '@rsk/mcp-adapter';
import type { ExecutionEnvelope } from '@rsk/core';

const program = new Command();

program
  .name('rsk-mcp')
  .description('Natural language Rootstock dev client')
  .option('--json', 'Emit raw JSON output')
  .option('--mcp-url <url>', 'Rootstock MCP base URL')
  .option('--mcp-api-key <key>', 'Bearer token for MCP transport')
  .option('--transport <mode>', 'MCP transport mode: mock | http', 'mock')
  .option('--timeout-ms <number>', 'MCP request timeout in ms', '10000')
  .option('--retries <number>', 'MCP retry count', '2')
  .argument('<prompt>', 'Natural language query')
  .action(
    async (
      prompt: string,
      options: {
        json?: boolean;
        mcpUrl?: string;
        mcpApiKey?: string;
        transport?: string;
        timeoutMs?: string;
        retries?: string;
      }
    ) => {
      const runtime = loadRuntimeConfig(process.env);
      const transport = (options.transport ?? runtime.transport) as McpTransportMode;
      const mcpUrl = options.mcpUrl ?? runtime.mcpUrl;
      const mcpApiKey = options.mcpApiKey ?? runtime.mcpApiKey;
      const timeoutMs = Number(options.timeoutMs ?? runtime.timeoutMs);
      const retries = Number(options.retries ?? runtime.retries);
      if (transport === 'http' && !mcpUrl) {
        throw new Error('MCP URL is required when --transport http is used.');
      }

      const orchestrator = new Orchestrator({
        mcp: {
          transport,
          baseUrl: mcpUrl,
          apiKey: mcpApiKey,
          timeoutMs,
          retries
        },
        llm: {
          provider: runtime.llmProvider,
          apiKey: runtime.llmApiKey,
          model: runtime.llmModel,
          baseUrl: runtime.llmBaseUrl
        }
      });
      const result = await orchestrator.run(prompt);
      const first = unwrapEnvelope(result.output[0]);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`Intent: ${result.intent.action} on ${result.intent.chain}`);
      console.log(`Plan: ${result.plan.steps.map((s) => s.method).join(', ')}`);

      if (result.intent.action === 'list_pegins') {
        const rows = (first as { rows?: Array<Record<string, unknown>> }).rows ?? [];
        console.table(rows);
        return;
      }

      if (result.intent.action === 'inspect_bridge_events') {
        const rows = (first as { rows?: Array<Record<string, unknown>> }).rows ?? [];
        console.table(rows);
        return;
      }

      if (result.intent.action === 'simulate_tx') {
        console.log('Simulation Result:', JSON.stringify(first, null, 2));
        return;
      }

      console.log('Output:', JSON.stringify(first, null, 2));
    }
  );

function unwrapEnvelope(payload: unknown): unknown {
  const envelope = payload as ExecutionEnvelope | undefined;
  if (envelope?.success === false) {
    throw new Error(
      `[${envelope.error?.code ?? 'UNKNOWN'}] ${envelope.error?.message ?? 'Unknown MCP error'}`
    );
  }
  if (envelope?.success === true) {
    return envelope.data;
  }
  return payload;
}

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error('Command failed:', error);
  process.exitCode = 1;
});
