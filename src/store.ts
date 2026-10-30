import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, opendir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

/** User-local files only. A claimed preview is never submitted twice, including after a crash. */
export class Store {
  constructor(readonly dir = process.env.JUMP_AGENT_DIR || join(homedir(), '.jump-agent')) {}

  async init() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const stat = await lstat(this.dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid())) throw new Error('Unsafe Agent state directory');
    await chmod(this.dir, 0o700);
  }

  private path(key: string) {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(key)) throw new Error('Invalid local record ID');
    return join(this.dir, `${key}.json`);
  }

  async put(key: string, value: unknown) {
    const data = JSON.stringify(value);
    if (Buffer.byteLength(data) > 1_000_000) throw new Error('Agent record exceeds size limit');
    await this.init();
    const tmp = join(this.dir, `${randomUUID()}.tmp`);
    const file = await open(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
      await rename(tmp, this.path(key));
      await this.syncDirectory();
    } finally { await rm(tmp, { force: true }); }
  }

  async get(key: string): Promise<any> {
    await this.init();
    const file = await open(this.path(key), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 1_000_000 || (stat.mode & 0o077) ||
          (process.getuid && stat.uid !== process.getuid())) throw new Error('Unsafe Agent record');
      return JSON.parse(await file.readFile('utf8'));
    } finally { await file.close(); }
  }

  async claim(key: string) {
    await this.init();
    const file = await open(`${this.path(key)}.claimed`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await file.sync(); } finally { await file.close(); }
    await this.syncDirectory();
  }

  async isClaimed(key: string) {
    try { await lstat(`${this.path(key)}.claimed`); return true; }
    catch (error: any) { if (error.code === 'ENOENT') return false; throw error; }
  }

  async optional(key: string) {
    try { return await this.get(key); }
    catch (error: any) { if (error.code === 'ENOENT') return undefined; throw error; }
  }

  async locked<T>(key: string, action: () => Promise<T>): Promise<T> {
    await this.init();
    const path = `${this.path(key)}.lock`;
    const lock = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { return await action(); }
    finally { await lock.close(); await rm(path); await this.syncDirectory(); }
  }

  async update(key: string, change: (current: any) => any) {
    return this.locked(`record-${key}`, async () => {
      const result = change(await this.get(key));
      await this.put(key, result);
      return result;
    });
  }

  async previews() {
    await this.init();
    const dated: { name: string; time: number }[] = [];
    let batch: Promise<{ name: string; time: number }>[] = [];
    const flush = async () => {
      dated.push(...await Promise.all(batch));
      dated.sort((a, b) => b.time - a.time).splice(200);
      batch = [];
    };
    for await (const entry of await opendir(this.dir)) {
      if (!entry.isFile() || !/^[a-f0-9-]{36}\.json$/.test(entry.name)) continue;
      batch.push(lstat(join(this.dir, entry.name)).then(stat => ({ name: entry.name, time: stat.mtimeMs })));
      if (batch.length === 32) await flush();
    }
    await flush();
    // Bounded metadata concurrency and retained history; session files are never opened.
    const records: { id: string; record: any; claimed: boolean }[] = [];
    for (let offset = 0; offset < dated.length; offset += 32) {
      records.push(...await Promise.all(dated.slice(offset, offset + 32).map(async ({ name }) => {
        const id = name.slice(0, -5);
        return { id, record: await this.get(id), claimed: await this.isClaimed(id) };
      })));
    }
    return records;
  }

  async complete(key: string, previewId: string, record: any) {
    await this.locked(key, async () => {
      await this.put(previewId, record);
      const pending = await this.optional(key);
      // Repeating an old reconciliation must never clear a newer submission.
      if (pending?.previewId === previewId) await this.remove(key);
    });
  }

  async reserve(key: string, previewId: string) {
    await this.locked(key, async () => {
      if (await this.optional(key)) throw new Error('Wallet has an unresolved submission; reconcile it before starting another transaction');
      await this.put(key, { previewId });
    });
  }

  async release(key: string, previewId: string) {
    await this.locked(key, async () => {
      const pending = await this.optional(key);
      if (pending && pending.previewId !== previewId) throw new Error('Pending submission identity mismatch');
      await this.remove(key);
    });
  }

  private async syncDirectory() {
    const directory = await open(this.dir, constants.O_RDONLY);
    try { await directory.sync(); } finally { await directory.close(); }
  }

  async remove(key: string) {
    await this.init(); await rm(this.path(key), { force: true }); await this.syncDirectory();
  }
}

export const sessionKey = (api: string, chain: number, wallet: string) =>
  `session-${createHash('sha256').update(`${api}|${chain}|${wallet.toLowerCase()}`).digest('hex')}`;

// All CLI/MCP money operations for a wallet on a chain share one reservation.
export const submissionKey = (chain: number, wallet: string) =>
  `pending-${createHash('sha256').update(`${chain}|${wallet.toLowerCase()}`).digest('hex')}`;
