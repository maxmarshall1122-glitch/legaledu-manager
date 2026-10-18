import fs from "node:fs";
import path from "node:path";
import { MemoryRepo, type Snapshot } from "./memory-repo";

/**
 * DEMO MODE ONLY. Persists the in-memory store to a JSON file on the local
 * server disk. This is a development convenience, not a production database:
 * no concurrency control across processes, no backups, no encryption at rest.
 */
export class FileRepo extends MemoryRepo {
  readonly kind = "file" as const;
  private mtimeMs = 0;

  constructor(
    private filePath: string,
    initial?: Snapshot,
  ) {
    super();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (initial || !fs.existsSync(filePath)) this.write(initial ?? this.data);
    this.load();
  }

  private load() {
    const stat = fs.statSync(this.filePath);
    this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.filePath, "utf8")) };
    this.mtimeMs = stat.mtimeMs;
  }

  private write(snapshot: Snapshot) {
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot), { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }

  protected beforeRead(): void {
    // Another module instance in the same server may have written the file.
    const stat = fs.statSync(this.filePath, { throwIfNoEntry: false });
    if (stat && stat.mtimeMs !== this.mtimeMs) this.load();
  }

  protected afterWrite(): void {
    this.write(this.data);
    this.mtimeMs = fs.statSync(this.filePath).mtimeMs;
  }

  reset(snapshot: Snapshot) {
    this.write(snapshot);
    this.load();
  }
}
