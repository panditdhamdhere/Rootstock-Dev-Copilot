import { intentSchema, type Intent } from '@rsk/core';

export type IntentEngineOptions = {
  provider?: 'none' | 'openai' | 'anthropic';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
};

export class IntentEngine {
  private readonly provider: 'none' | 'openai' | 'anthropic';

  private readonly apiKey?: string;

  private readonly model: string;

  private readonly baseUrl?: string;

  private readonly timeoutMs: number;

  constructor(options: IntentEngineOptions = {}) {
    this.provider = options.provider ?? 'none';
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'gpt-4.1-mini';
    this.baseUrl = options.baseUrl;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async parse(prompt: string): Promise<Intent> {
    const providerResult = await this.tryProviderParse(prompt);
    if (providerResult) {
      return providerResult;
    }
    return this.parseHeuristically(prompt);
  }

  private parseHeuristically(prompt: string): Intent {
    const normalized = prompt.toLowerCase();
    const chain = normalized.includes('mainnet') ? 'rsk-mainnet' : 'rsk-testnet';

    if (normalized.includes('last') && normalized.includes('peg-in')) {
      const match = normalized.match(/last\s+(\d+)/);
      const limit = match?.[1] ? Number(match[1]) : 5;

      return intentSchema.parse({
        action: 'list_pegins',
        chain,
        limit,
        params: {}
      });
    }

    if (normalized.includes('simulate') || normalized.includes('simulation')) {
      const toMatch = prompt.match(/to\s+(0x[a-fA-F0-9]{40})/);
      const fromMatch = prompt.match(/from\s+(0x[a-fA-F0-9]{40})/);
      const dataMatch = prompt.match(/data\s+(0x[a-fA-F0-9]+)/);
      const valueMatch = prompt.match(/value\s+(\d+)/);

      const stateOverride = this.extractStateOverride(prompt);

      return intentSchema.parse({
        action: 'simulate_tx',
        chain,
        params: {
          from: fromMatch?.[1] ?? '0x0000000000000000000000000000000000000001',
          to: toMatch?.[1] ?? '0x0000000000000000000000000000000000000002',
          data: dataMatch?.[1] ?? '0x',
          valueWei: valueMatch?.[1] ?? '0',
          ...(stateOverride ? { stateOverride } : {})
        }
      });
    }

    if (normalized.includes('bridge events') || normalized.includes('peg-out') || normalized.includes('peg-in')) {
      const match = normalized.match(/last\s+(\d+)/);
      const limit = match?.[1] ? Number(match[1]) : 10;
      const direction = normalized.includes('peg-out') ? 'pegout' : normalized.includes('peg-in') ? 'pegin' : 'all';

      return intentSchema.parse({
        action: 'inspect_bridge_events',
        chain,
        limit,
        params: {
          direction
        }
      });
    }

    return intentSchema.parse({
      action: 'generic_rpc',
      chain,
      params: { prompt }
    });
  }

  private async tryProviderParse(prompt: string): Promise<Intent | undefined> {
    if (this.provider === 'none' || !this.apiKey) {
      return undefined;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const raw =
        this.provider === 'openai'
          ? await this.callOpenAI(prompt, controller.signal)
          : await this.callAnthropic(prompt, controller.signal);
      clearTimeout(timer);
      const parsed = JSON.parse(raw) as unknown;
      return intentSchema.parse(parsed);
    } catch {
      return undefined;
    }
  }

  private async callOpenAI(prompt: string, signal: AbortSignal): Promise<string> {
    const url = this.baseUrl ?? 'https://api.openai.com/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      signal,
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Return only a JSON object matching this schema: {action, chain, limit?, params}. action must be one of list_pegins|simulate_tx|inspect_bridge_events|generic_rpc. chain must be rsk-mainnet or rsk-testnet.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI call failed: ${response.status}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.choices?.[0]?.message?.content ?? '{}';
  }

  private async callAnthropic(prompt: string, signal: AbortSignal): Promise<string> {
    const url = this.baseUrl ?? 'https://api.anthropic.com/v1/messages';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey ?? '',
        'anthropic-version': '2023-06-01'
      },
      signal,
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        temperature: 0,
        system:
          'Return only a JSON object matching this schema: {action, chain, limit?, params}. action must be one of list_pegins|simulate_tx|inspect_bridge_events|generic_rpc. chain must be rsk-mainnet or rsk-testnet.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      throw new Error(`Anthropic call failed: ${response.status}`);
    }
    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    return payload.content?.find((item) => item.type === 'text')?.text ?? '{}';
  }

  private extractStateOverride(prompt: string): Record<string, unknown> | undefined {
    const overrideMatch = prompt.match(/override\s+(\{.*\})/i);
    if (!overrideMatch?.[1]) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(overrideMatch[1]) as Record<string, unknown>;
      return parsed;
    } catch {
      return undefined;
    }
  }
}
