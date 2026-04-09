import {
  bridgeEventSchema,
  pegInTxSchema,
  simulationResultSchema,
  type BridgeEvent,
  type ExecutionEnvelope,
  type PegInTx,
  type ToolPlanStep,
  type TxSimulationResult
} from '@rsk/core';
import { z } from 'zod';

export type McpTransportMode = 'mock' | 'http';

export type McpAdapterOptions = {
  transport?: McpTransportMode;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;

export class McpAdapter {
  private readonly transport: McpTransportMode;

  private readonly baseUrl?: string;

  private readonly apiKey?: string;

  private readonly timeoutMs: number;

  private readonly retries: number;

  constructor(options: McpAdapterOptions = {}) {
    this.transport = options.transport ?? (options.baseUrl ? 'http' : 'mock');
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = options.retries ?? DEFAULT_RETRIES;
  }

  async execute(step: ToolPlanStep): Promise<unknown> {
    const requestId = this.createRequestId(step.method);
    if (this.transport === 'mock') {
      return this.successEnvelope(requestId, step.method, this.executeMock(step));
    }
    return this.executeHttp(step, requestId);
  }

  private async executeHttp(step: ToolPlanStep, requestId: string): Promise<ExecutionEnvelope> {
    if (!this.baseUrl) {
      return this.errorEnvelope(
        requestId,
        step.method,
        'CONFIG_ERROR',
        'HTTP transport selected but MCP base URL is missing.'
      );
    }

    const endpoint = new URL('/tools/call', this.baseUrl).toString();
    const payload = {
      method: step.method,
      params: step.params
    };

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timer);

        if (!response.ok) {
          const text = await response.text();
          if (attempt < this.retries && response.status >= 500) {
            continue;
          }
          return this.errorEnvelope(
            requestId,
            step.method,
            'HTTP_ERROR',
            `MCP request failed with HTTP ${response.status}: ${text || 'no body'}`,
            response.status
          );
        }

        const responsePayload = (await response.json()) as unknown;
        try {
          return this.successEnvelope(
            requestId,
            step.method,
            this.normalizeData(step.method, responsePayload)
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Response validation failed';
          return this.errorEnvelope(requestId, step.method, 'VALIDATION_ERROR', message);
        }
      } catch (error) {
        if (attempt < this.retries) {
          continue;
        }
        const message = error instanceof Error ? error.message : 'Unknown transport error';
        return this.errorEnvelope(requestId, step.method, 'TRANSPORT_ERROR', message);
      }
    }

    return this.errorEnvelope(requestId, step.method, 'RETRIES_EXHAUSTED', 'Retries exhausted.');
  }

  private executeMock(step: ToolPlanStep): unknown {
    if (step.method === 'bridge.listPegIns') {
      const limit = Number(step.params.limit ?? 5);
      const rows: PegInTx[] = Array.from({ length: limit }).map((_, i) => ({
        btcTxId: `mock-btc-tx-${i + 1}`,
        rskTxHash: `0xmockrsk${i + 1}`,
        amountSats: `${(i + 1) * 100000}`,
        timestamp: new Date(Date.now() - i * 60_000).toISOString()
      }));
      return { rows };
    }

    if (step.method === 'evm.simulateTransaction') {
      const data = String(step.params.data ?? '0x');
      const stateOverride =
        step.params.stateOverride && typeof step.params.stateOverride === 'object'
          ? (step.params.stateOverride as Record<string, unknown>)
          : undefined;

      const shouldRevert = data.startsWith('0xdeadbeef');
      const simulated: TxSimulationResult = {
        ok: !shouldRevert,
        gasUsed: shouldRevert ? '38021' : '45231',
        returnData: shouldRevert ? '0x08c379a0' : '0x',
        decoded: shouldRevert
          ? 'Execution reverted with Error(string)'
          : 'Mock simulation successful',
        revertReason: shouldRevert ? 'Mock revert for testing decode path' : undefined
      };
      return {
        ...simulated,
        stateOverrideApplied: Boolean(stateOverride)
      };
    }

    if (step.method === 'bridge.streamEvents') {
      const limit = Number(step.params.limit ?? 10);
      const direction = String(step.params.direction ?? 'all');
      const rows: BridgeEvent[] = Array.from({ length: limit }).map((_, i) => {
        const dir = direction === 'all' ? (i % 2 === 0 ? 'pegin' : 'pegout') : direction;
        return {
          id: `mock-bridge-${i + 1}`,
          chain:
            String(step.params.chain) === 'rsk-mainnet'
              ? 'rsk-mainnet'
              : 'rsk-testnet',
          direction: dir === 'pegout' ? 'pegout' : 'pegin',
          btcTxId: `mock-btc-${i + 1}`,
          rskTxHash: `0xmockbridge${i + 1}`,
          amountSats: `${(i + 1) * 75000}`,
          timestamp: new Date(Date.now() - i * 15_000).toISOString(),
          status: i % 3 === 0 ? 'pending' : 'confirmed'
        };
      });

      return { rows };
    }

    return {
      message:
        'No MCP mapping yet for this request. This is expected in bootstrap mode.',
      step
    };
  }

  private createRequestId(method: string): string {
    return `${method}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }

  private normalizeData(method: string, payload: unknown): unknown {
    if (method === 'bridge.listPegIns') {
      const rows = this.pickRows(payload);
      return { rows: z.array(pegInTxSchema).parse(rows) };
    }

    if (method === 'bridge.streamEvents') {
      const rows = this.pickRows(payload);
      return { rows: z.array(bridgeEventSchema).parse(rows) };
    }

    if (method === 'evm.simulateTransaction') {
      const target = this.pickData(payload);
      return simulationResultSchema.parse(target);
    }

    return payload;
  }

  private pickRows(payload: unknown): unknown {
    if (this.isRecord(payload) && Array.isArray(payload.rows)) {
      return payload.rows;
    }
    if (
      this.isRecord(payload) &&
      this.isRecord(payload.result) &&
      Array.isArray((payload.result as Record<string, unknown>).rows)
    ) {
      return (payload.result as Record<string, unknown>).rows;
    }
    return [];
  }

  private pickData(payload: unknown): unknown {
    if (this.isRecord(payload) && this.isRecord(payload.result)) {
      return payload.result;
    }
    return payload;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private successEnvelope(requestId: string, method: string, data: unknown): ExecutionEnvelope {
    return {
      requestId,
      method,
      success: true,
      data
    };
  }

  private errorEnvelope(
    requestId: string,
    method: string,
    code: string,
    message: string,
    status?: number
  ): ExecutionEnvelope {
    return {
      requestId,
      method,
      success: false,
      error: {
        code,
        message,
        status
      }
    };
  }
}
