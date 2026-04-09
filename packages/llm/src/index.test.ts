import { describe, expect, it } from 'vitest';
import { IntentEngine } from './index.js';

describe('IntentEngine', () => {
  it('parses simulation prompt with override JSON', async () => {
    const engine = new IntentEngine();
    const intent = await engine.parse(
      'simulate tx on testnet from 0x0000000000000000000000000000000000000001 to 0x0000000000000000000000000000000000000002 data 0xabcdef override {"0x0000000000000000000000000000000000000002":{"balance":"0x1"}}'
    );

    expect(intent.action).toBe('simulate_tx');
    expect(intent.params.stateOverride).toBeTypeOf('object');
  });

  it('parses bridge event inspection prompts', async () => {
    const engine = new IntentEngine();
    const intent = await engine.parse('show me last 7 bridge events on mainnet');

    expect(intent.action).toBe('inspect_bridge_events');
    expect(intent.chain).toBe('rsk-mainnet');
    expect(intent.limit).toBe(7);
  });
});
