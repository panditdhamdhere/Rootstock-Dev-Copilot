import { loadRuntimeConfig } from '@rsk/config';
import { Orchestrator } from '@rsk/orchestrator';

async function run(): Promise<void> {
  const runtime = loadRuntimeConfig(process.env);

  const orchestrator = new Orchestrator({
    mcp: {
      transport: runtime.transport,
      baseUrl: runtime.mcpUrl,
      apiKey: runtime.mcpApiKey,
      timeoutMs: runtime.timeoutMs,
      retries: runtime.retries
    }
  });

  const checks = [
    'show me the last 2 peg-in transactions on testnet',
    'simulate tx on testnet from 0x0000000000000000000000000000000000000001 to 0x0000000000000000000000000000000000000002 data 0xabcdef',
    'show me last 2 bridge events on testnet'
  ];

  for (const prompt of checks) {
    const result = await orchestrator.run(prompt);
    const first = result.output[0] as
      | { success: true; data: unknown }
      | { success: false; error?: { message?: string } }
      | undefined;

    if (!first || first.success !== true) {
      const reason = first && 'error' in first ? first.error?.message : 'unknown failure';
      throw new Error(`Live readiness check failed for prompt "${prompt}": ${reason}`);
    }
  }

  console.log(
    `Live readiness passed using transport="${runtime.transport}"${runtime.mcpUrl ? ` url="${runtime.mcpUrl}"` : ''}`
  );
}

run().catch((error: unknown) => {
  console.error('Live readiness failed:', error);
  process.exitCode = 1;
});
