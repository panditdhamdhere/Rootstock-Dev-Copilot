import { z } from 'zod';

export const chainSchema = z.enum(['rsk-mainnet', 'rsk-testnet']);

export const intentSchema = z.object({
  action: z.enum(['list_pegins', 'simulate_tx', 'inspect_bridge_events', 'generic_rpc']),
  chain: chainSchema,
  limit: z.number().int().positive().max(100).optional(),
  params: z.record(z.string(), z.unknown()).default({})
});

export type Intent = z.infer<typeof intentSchema>;

export type ToolPlanStep = {
  tool: 'mcp.call';
  method: string;
  params: Record<string, unknown>;
};

export type ToolPlan = {
  rationale: string;
  steps: ToolPlanStep[];
};

export type PegInTx = {
  btcTxId: string;
  rskTxHash: string;
  amountSats: string;
  timestamp: string;
};

export const pegInTxSchema = z.object({
  btcTxId: z.string(),
  rskTxHash: z.string(),
  amountSats: z.string(),
  timestamp: z.string()
});

export type TxSimulationRequest = {
  chain: 'rsk-mainnet' | 'rsk-testnet';
  from: string;
  to: string;
  data: string;
  valueWei?: string;
  stateOverride?: Record<string, unknown>;
};

export type TxSimulationResult = {
  ok: boolean;
  gasUsed: string;
  returnData: string;
  decoded?: string;
  revertReason?: string;
};

export type BridgeEventDirection = 'pegin' | 'pegout';

export type BridgeEvent = {
  id: string;
  chain: 'rsk-mainnet' | 'rsk-testnet';
  direction: BridgeEventDirection;
  btcTxId: string;
  rskTxHash: string;
  amountSats: string;
  timestamp: string;
  status: 'confirmed' | 'pending';
};

export const bridgeEventSchema = z.object({
  id: z.string(),
  chain: chainSchema,
  direction: z.enum(['pegin', 'pegout']),
  btcTxId: z.string(),
  rskTxHash: z.string(),
  amountSats: z.string(),
  timestamp: z.string(),
  status: z.enum(['confirmed', 'pending'])
});

export const simulationResultSchema = z.object({
  ok: z.boolean(),
  gasUsed: z.string(),
  returnData: z.string(),
  decoded: z.string().optional(),
  revertReason: z.string().optional()
});

export type ExecutionEnvelope = {
  requestId: string;
  method: string;
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    status?: number;
  };
};
