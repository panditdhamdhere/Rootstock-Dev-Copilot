import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BridgeCursorStore } from './index.js';

let testDir = '';

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('BridgeCursorStore', () => {
  it('saves and loads cursor by chain', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'bridge-state-'));
    const store = new BridgeCursorStore(join(testDir, 'cursor.json'));

    await store.save({
      chain: 'rsk-testnet',
      lastEventId: 'evt-1',
      lastTimestamp: '2026-01-01T00:00:00.000Z'
    });

    const loaded = await store.load();
    expect(loaded['rsk-testnet']?.lastEventId).toBe('evt-1');
  });
});
