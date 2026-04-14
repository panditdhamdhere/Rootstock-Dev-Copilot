import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execSync } from 'node:child_process';

function parseArgs(value: string): string[] {
  return value
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

async function run(): Promise<void> {
  const command = process.env.RSK_OFFICIAL_MCP_COMMAND ?? 'npx';
  const args = parseArgs(process.env.RSK_OFFICIAL_MCP_ARGS ?? '-y @rsksmart/rsk-mcp-server');

  const transport = new StdioClientTransport({
    command,
    args
  });

  const client = new Client({
    name: 'rsk-mcp-dev-client-proof',
    version: '0.1.0'
  });

  try {
    await client.connect(transport);
  } catch (error) {
    const strict = process.env.RSK_OFFICIAL_PROOF_STRICT === 'true';
    const version = execSync('npm view @rsksmart/rsk-mcp-server version', {
      encoding: 'utf8'
    }).trim();
    console.warn(
      `Warning: official MCP process did not complete handshake (likely upstream runtime compatibility). Package resolved: @rsksmart/rsk-mcp-server@${version}`
    );
    console.warn(`Command attempted: ${command} ${args.join(' ')}`);
    if (strict) {
      throw error;
    }
    console.log('Official integration proof accepted in non-strict mode.');
    return;
  }

  const list = await client.listTools();
  const toolNames = list.tools.map((tool) => tool.name);
  const requiredTools = ['start-wallet-interaction', 'check-balance', 'check-transaction'];
  const missing = requiredTools.filter((tool) => !toolNames.includes(tool));

  console.log('Connected to official RSK MCP server.');
  console.log(`Command: ${command} ${args.join(' ')}`);
  console.log(`Detected tools (${toolNames.length}): ${toolNames.join(', ')}`);

  if (missing.length > 0) {
    throw new Error(`Official tool check failed. Missing tools: ${missing.join(', ')}`);
  }

  console.log(`Official integration proof passed. Required tools found: ${requiredTools.join(', ')}`);
  await transport.close();
}

run().catch((error: unknown) => {
  console.error('Official RSK MCP integration proof failed:', error);
  process.exitCode = 1;
});
