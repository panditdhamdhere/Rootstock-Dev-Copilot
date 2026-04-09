import { describe, expect, it } from 'vitest';
import { BridgeCursorStore } from '@rsk/bridge-state';
import { Orchestrator } from './index.js';
import type { ExecutionEnvelope } from '@rsk/core';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Orchestrator', () => {
  it('builds peg-in plan and executes it', async () => {
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run('show me the last 5 peg-in transactions on testnet');

    expect(result.intent.action).toBe('list_pegins');
    expect(result.plan.steps[0]?.method).toBe('bridge.listPegIns');
    const output = result.output[0] as ExecutionEnvelope;
    expect(output.success).toBe(true);
    expect(Array.isArray((output.data as { rows: unknown[] }).rows)).toBe(true);
  });

  it('builds simulation plan and executes it', async () => {
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run(
      'simulate tx on testnet from 0x0000000000000000000000000000000000000001 to 0x0000000000000000000000000000000000000002 data 0xabcdef'
    );

    expect(result.intent.action).toBe('simulate_tx');
    expect(result.plan.steps[0]?.method).toBe('evm.simulateTransaction');
    const output = result.output[0] as ExecutionEnvelope;
    expect(output.success).toBe(true);
    expect((output.data as { ok: boolean }).ok).toBe(true);
  });

  it('builds bridge event inspection plan and executes it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orchestrator-'));
    const store = new BridgeCursorStore(join(dir, 'bridge-cursor.json'));
    const orchestrator = new Orchestrator({ bridgeCursorStore: store });

    const result = await orchestrator.run('show me last 4 bridge events on testnet');

    expect(result.intent.action).toBe('inspect_bridge_events');
    expect(result.plan.steps[0]?.method).toBe('bridge.streamEvents');
    const output = result.output[0] as ExecutionEnvelope;
    expect(output.success).toBe(true);
    expect(Array.isArray((output.data as { rows: unknown[] }).rows)).toBe(true);

    const saved = JSON.parse(await readFile(join(dir, 'bridge-cursor.json'), 'utf8')) as {
      'rsk-testnet'?: { lastEventId: string };
    };
    expect(saved['rsk-testnet']?.lastEventId).toBe('mock-bridge-1');
    await rm(dir, { recursive: true, force: true });
  });
});
