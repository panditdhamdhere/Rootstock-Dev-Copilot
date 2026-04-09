import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpAdapter } from './index.js';
import type { ExecutionEnvelope } from '@rsk/core';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('McpAdapter', () => {
  it('returns mock peg-in rows in mock mode', async () => {
    const adapter = new McpAdapter({ transport: 'mock' });

    const result = (await adapter.execute({
      tool: 'mcp.call',
      method: 'bridge.listPegIns',
      params: { limit: 3 }
    })) as ExecutionEnvelope;

    expect(result.success).toBe(true);
    const data = result.data as { rows: Array<{ btcTxId: string }> };
    expect(data.rows).toHaveLength(3);
    expect(data.rows[0]?.btcTxId).toBe('mock-btc-tx-1');
  });

  it('retries HTTP call and returns decoded JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('temporary', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              rows: [
                {
                  btcTxId: 'abc',
                  rskTxHash: '0xhash',
                  amountSats: '1000',
                  timestamp: '2026-01-01T00:00:00.000Z'
                }
              ]
            }
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const adapter = new McpAdapter({
      transport: 'http',
      baseUrl: 'https://example.com',
      retries: 1,
      timeoutMs: 2000
    });

    const result = (await adapter.execute({
      tool: 'mcp.call',
      method: 'bridge.listPegIns',
      params: { chain: 'rsk-testnet', limit: 1 }
    })) as ExecutionEnvelope;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(typeof result.requestId).toBe('string');
    const data = result.data as { rows: Array<{ btcTxId: string }> };
    expect(data.rows[0]?.btcTxId).toBe('abc');
  });

  it('returns mock simulation result', async () => {
    const adapter = new McpAdapter({ transport: 'mock' });

    const result = (await adapter.execute({
      tool: 'mcp.call',
      method: 'evm.simulateTransaction',
      params: {
        chain: 'rsk-testnet',
        from: '0x0000000000000000000000000000000000000001',
        to: '0x0000000000000000000000000000000000000002',
        data: '0x'
      }
    })) as ExecutionEnvelope;

    expect(result.success).toBe(true);
    const data = result.data as { ok: boolean; gasUsed: string };
    expect(data.ok).toBe(true);
    expect(data.gasUsed).toBe('45231');
  });

  it('returns mock simulation revert result for revert-like calldata', async () => {
    const adapter = new McpAdapter({ transport: 'mock' });

    const result = (await adapter.execute({
      tool: 'mcp.call',
      method: 'evm.simulateTransaction',
      params: {
        chain: 'rsk-testnet',
        from: '0x0000000000000000000000000000000000000001',
        to: '0x0000000000000000000000000000000000000002',
        data: '0xdeadbeef'
      }
    })) as ExecutionEnvelope;

    expect(result.success).toBe(true);
    const data = result.data as { ok: boolean; revertReason?: string };
    expect(data.ok).toBe(false);
    expect(data.revertReason).toContain('Mock revert');
  });

  it('returns bridge event stream rows in mock mode', async () => {
    const adapter = new McpAdapter({ transport: 'mock' });

    const result = (await adapter.execute({
      tool: 'mcp.call',
      method: 'bridge.streamEvents',
      params: {
        chain: 'rsk-testnet',
        limit: 3,
        direction: 'all'
      }
    })) as ExecutionEnvelope;

    expect(result.success).toBe(true);
    const data = result.data as { rows: Array<{ direction: string }> };
    expect(data.rows).toHaveLength(3);
    expect(data.rows[0]?.direction).toBe('pegin');
  });

  it('returns normalized error envelope for invalid HTTP payload', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { rows: [{ notDirection: 'x' }] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new McpAdapter({
      transport: 'http',
      baseUrl: 'https://example.com',
      retries: 0,
      timeoutMs: 2000
    });

    const result = (await adapter.execute({
      tool: 'mcp.call',
      method: 'bridge.streamEvents',
      params: { chain: 'rsk-testnet', limit: 1 }
    })) as ExecutionEnvelope;

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });
});
