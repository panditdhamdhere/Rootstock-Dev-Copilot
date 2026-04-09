import { BridgeCursorStore } from '@rsk/bridge-state';
import type { BridgeEvent, ExecutionEnvelope, Intent, ToolPlan, TxSimulationRequest } from '@rsk/core';
import { IntentEngine, type IntentEngineOptions } from '@rsk/llm';
import { McpAdapter, type McpAdapterOptions } from '@rsk/mcp-adapter';
import { createLogger, type Logger } from '@rsk/observability';

export type OrchestratorOptions = {
  mcp?: McpAdapterOptions;
  llm?: IntentEngineOptions;
  logger?: Logger;
  bridgeCursorStore?: BridgeCursorStore;
};

export class Orchestrator {
  private readonly intentEngine: IntentEngine;

  private readonly mcp: McpAdapter;

  private readonly logger: Logger;

  private readonly bridgeCursorStore: BridgeCursorStore;

  constructor(options: OrchestratorOptions = {}) {
    this.intentEngine = new IntentEngine(options.llm);
    this.mcp = new McpAdapter(options.mcp);
    this.logger = options.logger ?? createLogger('orchestrator');
    this.bridgeCursorStore = options.bridgeCursorStore ?? new BridgeCursorStore();
  }

  plan(intent: Intent): ToolPlan {
    if (intent.action === 'list_pegins') {
      return {
        rationale: 'Requested latest peg-in transactions from PowPeg bridge.',
        steps: [
          {
            tool: 'mcp.call',
            method: 'bridge.listPegIns',
            params: {
              chain: intent.chain,
              limit: intent.limit ?? 5
            }
          }
        ]
      };
    }

    if (intent.action === 'simulate_tx') {
      const tx = this.toSimulationRequest(intent);
      return {
        rationale: 'Requested transaction simulation using eth_call-compatible inputs.',
        steps: [
          {
            tool: 'mcp.call',
            method: 'evm.simulateTransaction',
            params: tx
          }
        ]
      };
    }

    if (intent.action === 'inspect_bridge_events') {
      return {
        rationale: 'Requested decoded PowPeg bridge event feed.',
        steps: [
          {
            tool: 'mcp.call',
            method: 'bridge.streamEvents',
            params: {
              chain: intent.chain,
              limit: intent.limit ?? 10,
              direction: intent.params.direction ?? 'all',
              cursor: intent.params.cursor ?? null
            }
          }
        ]
      };
    }

    return {
      rationale: 'Fallback generic RPC inspection route.',
      steps: [
        {
          tool: 'mcp.call',
          method: 'rpc.generic',
          params: {
            chain: intent.chain,
            ...intent.params
          }
        }
      ]
    };
  }

  async run(prompt: string): Promise<{ intent: Intent; plan: ToolPlan; output: unknown[] }> {
    const intent = await this.intentEngine.parse(prompt);
    if (intent.action === 'inspect_bridge_events') {
      const state = await this.bridgeCursorStore.load();
      intent.params.cursor = state[intent.chain]?.lastEventId;
    }
    const plan = this.plan(intent);
    this.logger.log('info', 'plan.created', {
      action: intent.action,
      chain: intent.chain,
      steps: plan.steps.map((step) => step.method)
    });

    const output = await Promise.all(plan.steps.map((step) => this.mcp.execute(step)));
    this.logger.log('info', 'plan.executed', {
      action: intent.action,
      outputs: output.length
    });

    await this.maybePersistBridgeCursor(intent, output);

    return { intent, plan, output };
  }

  private async maybePersistBridgeCursor(intent: Intent, output: unknown[]): Promise<void> {
    if (intent.action !== 'inspect_bridge_events') {
      return;
    }
    const envelope = output[0] as ExecutionEnvelope | undefined;
    if (!envelope?.success) {
      return;
    }
    const rows = (envelope.data as { rows?: BridgeEvent[] } | undefined)?.rows ?? [];
    const latest = rows[0];
    if (!latest) {
      return;
    }
    await this.bridgeCursorStore.save({
      chain: latest.chain,
      lastEventId: latest.id,
      lastTimestamp: latest.timestamp
    });
    this.logger.log('info', 'bridge.cursor.saved', {
      chain: latest.chain,
      eventId: latest.id,
      timestamp: latest.timestamp
    });
  }

  private toSimulationRequest(intent: Intent): TxSimulationRequest {
    const from = String(intent.params.from ?? '0x0000000000000000000000000000000000000001');
    const to = String(intent.params.to ?? '0x0000000000000000000000000000000000000002');
    const data = String(intent.params.data ?? '0x');
    const valueWei = String(intent.params.valueWei ?? '0');
    const stateOverride =
      intent.params.stateOverride && typeof intent.params.stateOverride === 'object'
        ? (intent.params.stateOverride as Record<string, unknown>)
        : undefined;

    return {
      chain: intent.chain,
      from,
      to,
      data,
      valueWei,
      stateOverride
    };
  }
}
