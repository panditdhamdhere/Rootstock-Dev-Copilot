import { z } from 'zod';

const envSchema = z.object({
  RSK_MCP_TRANSPORT: z.enum(['mock', 'http']).default('mock'),
  RSK_MCP_URL: z.string().url().optional(),
  RSK_MCP_API_KEY: z.string().optional(),
  RSK_LLM_PROVIDER: z.enum(['none', 'openai', 'anthropic']).default('none'),
  RSK_LLM_API_KEY: z.string().optional(),
  RSK_LLM_MODEL: z.string().default('gpt-4.1-mini'),
  RSK_LLM_BASE_URL: z.string().url().optional(),
  RSK_MCP_TIMEOUT_MS: z.string().regex(/^\d+$/).default('10000'),
  RSK_MCP_RETRIES: z.string().regex(/^\d+$/).default('2')
});

export type RuntimeConfig = {
  transport: 'mock' | 'http';
  mcpUrl?: string;
  mcpApiKey?: string;
  llmProvider: 'none' | 'openai' | 'anthropic';
  llmApiKey?: string;
  llmModel: string;
  llmBaseUrl?: string;
  timeoutMs: number;
  retries: number;
};

export function loadRuntimeConfig(env: NodeJS.ProcessEnv): RuntimeConfig {
  const parsed = envSchema.parse(env);

  if (parsed.RSK_MCP_TRANSPORT === 'http' && !parsed.RSK_MCP_URL) {
    throw new Error('RSK_MCP_URL is required when RSK_MCP_TRANSPORT=http');
  }

  return {
    transport: parsed.RSK_MCP_TRANSPORT,
    mcpUrl: parsed.RSK_MCP_URL,
    mcpApiKey: parsed.RSK_MCP_API_KEY,
    llmProvider: parsed.RSK_LLM_PROVIDER,
    llmApiKey: parsed.RSK_LLM_API_KEY,
    llmModel: parsed.RSK_LLM_MODEL,
    llmBaseUrl: parsed.RSK_LLM_BASE_URL,
    timeoutMs: Number(parsed.RSK_MCP_TIMEOUT_MS),
    retries: Number(parsed.RSK_MCP_RETRIES)
  };
}
