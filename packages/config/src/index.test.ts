import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig } from './index.js';

describe('loadRuntimeConfig', () => {
  it('loads defaults', () => {
    const config = loadRuntimeConfig({});
    expect(config.transport).toBe('mock');
    expect(config.llmProvider).toBe('none');
    expect(config.timeoutMs).toBe(10000);
  });

  it('fails when HTTP transport has no URL', () => {
    expect(() => loadRuntimeConfig({ RSK_MCP_TRANSPORT: 'http' })).toThrow(
      /RSK_MCP_URL/
    );
  });
});
