import { Orchestrator } from '@rsk/orchestrator';

async function run(): Promise<void> {
  const orchestrator = new Orchestrator({
    mcp: { transport: 'mock' }
  });

  const pegin = await orchestrator.run('show me the last 2 peg-in transactions on testnet');
  const simulation = await orchestrator.run(
    'simulate tx on testnet from 0x0000000000000000000000000000000000000001 to 0x0000000000000000000000000000000000000002 data 0xabcdef'
  );
  const bridge = await orchestrator.run('show me last 2 bridge events on testnet');

  if (pegin.output.length !== 1 || simulation.output.length !== 1 || bridge.output.length !== 1) {
    throw new Error('Smoke test failed: unexpected output shape');
  }

  console.log('Production smoke checks passed.');
}

run().catch((error: unknown) => {
  console.error('Smoke test failed:', error);
  process.exitCode = 1;
});
