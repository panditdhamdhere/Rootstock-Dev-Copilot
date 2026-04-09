import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export type BridgeCursor = {
  chain: 'rsk-mainnet' | 'rsk-testnet';
  lastEventId: string;
  lastTimestamp: string;
};

export class BridgeCursorStore {
  private readonly path: string;

  constructor(path = resolve(process.cwd(), '.state/bridge-cursor.json')) {
    this.path = path;
  }

  async load(): Promise<Partial<Record<'rsk-mainnet' | 'rsk-testnet', BridgeCursor>>> {
    try {
      const raw = await readFile(this.path, 'utf8');
      return JSON.parse(raw) as Partial<Record<'rsk-mainnet' | 'rsk-testnet', BridgeCursor>>;
    } catch {
      return {};
    }
  }

  async save(cursor: BridgeCursor): Promise<void> {
    const existing = await this.load();
    const next = {
      ...existing,
      [cursor.chain]: cursor
    };
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(next, null, 2), 'utf8');
  }
}
