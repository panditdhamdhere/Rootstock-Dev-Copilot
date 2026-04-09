import { loadRuntimeConfig } from '@rsk/config';
import { Orchestrator } from '@rsk/orchestrator';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('rskMcp.query', async () => {
    const prompt = await vscode.window.showInputBox({
      prompt: 'Ask Rootstock MCP in plain English',
      placeHolder: 'show me the last 5 peg-in transactions on testnet'
    });

    if (!prompt) {
      return;
    }

    try {
      const runtime = loadRuntimeConfig(process.env);
      const orchestrator = new Orchestrator({
        mcp: {
          transport: runtime.transport,
          baseUrl: runtime.mcpUrl,
          apiKey: runtime.mcpApiKey,
          timeoutMs: runtime.timeoutMs,
          retries: runtime.retries
        },
        llm: {
          provider: runtime.llmProvider,
          apiKey: runtime.llmApiKey,
          model: runtime.llmModel,
          baseUrl: runtime.llmBaseUrl
        }
      });

      const result = await orchestrator.run(prompt);
      const panel = vscode.window.createOutputChannel('RSK MCP');
      panel.appendLine(JSON.stringify(result, null, 2));
      panel.show(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown extension error';
      vscode.window.showErrorMessage(`RSK MCP query failed: ${message}`);
    }
  });

  context.subscriptions.push(command);
}

export function deactivate(): void {
  // No background resources to dispose.
}
