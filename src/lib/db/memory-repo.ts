import { randomUUID } from "node:crypto";
import { TABLES, type Row, type TableName } from "@/lib/types";
import { FOREIGN_KEYS, HAS_UPDATED_AT, UNIQUE_KEYS } from "./schema-meta";
import { RepoError, type NewRow, type Query, type Repo } from "./repo";

export type Snapshot = { [K in TableName]: Row<K>[] };

export function emptySnapshot(): Snapshot {
  return Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Snapshot;
}

type AnyRow = Record<string, unknown> & { id: string };

/**
 * In-memory repository that enforces the same unique / foreign-key / ON DELETE
 * rules as the PostgreSQL schema. Used for automated tests and as the base of
 * the demo-mode file repository.
 */
export class MemoryRepo implements Repo {
  readonly kind: "memory" | "file" = "memory";
  protected data: Snapshot;

  constructor(snapshot?: Snapshot) {
    this.data = snapshot ? structuredClone(snapshot) : emptySnapshot();
    for (const t of TABLES) this.data[t] ??= [] as never;
  }

  /** Hook for persistent subclasses. */
  protected beforeRead(): void {}
  protected afterWrite(): void {}

  snapshot(): Snapshot {
    this.beforeRead();
    return structuredClone(this.data);
  }

  private rows(table: TableName): AnyRow[] {
    return this.data[table] as unknown as AnyRow[];
  }

  async list<T extends TableName>(table: T, query: Query<Row<T>> = {}): Promise<Row<T>[]> {
    this.beforeRead();
    let out = this.rows(table).filter((r) => {
      if (query.eq) {
        for (const [k, v] of Object.entries(query.eq)) {
          if ((r[k] ?? null) !== (v ?? null)) return false;
        }
      }
      if (query.in) {
        const vals = new Set<unknown>(query.in.values);
        if (!vals.has(r[query.in.column])) return false;
      }
      return true;
    });
    if (query.order) {
      const { column, ascending = true } = query.order;
      out = [...out].sort((a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1));
    }
    if (query.limit !== undefined) out = out.slice(0, query.limit);
    return structuredClone(out) as unknown as Row<T>[];
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    this.beforeRead();
    const r = this.rows(table).find((x) => x.id === id);
    return r ? (structuredClone(r) as unknown as Row<T>) : null;
  }

  async insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
    this.beforeRead();
    const now = new Date().toISOString();
    const full: AnyRow = { id: randomUUID(), created_at: now, ...(row as object) } as AnyRow;
    if (HAS_UPDATED_AT.has(table)) full.updated_at = now;
    if (this.rows(table).some((r) => r.id === full.id)) throw new RepoError("unique_violation", `${table}.id`);
    this.checkUnique(table, full);
    this.checkForeignKeys(table, full);
    this.rows(table).push(full);
    this.afterWrite();
    return structuredClone(full) as unknown as Row<T>;
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    this.beforeRead();
    const rows = this.rows(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new RepoError("not_found", `${table} ${id} not found`);
    const { id: _ignored, created_at: _c, ...rest } = patch as AnyRow;
    void _ignored;
    void _c;
    const next: AnyRow = { ...rows[idx], ...rest };
    if (HAS_UPDATED_AT.has(table)) next.updated_at = new Date().toISOString();
    this.checkUnique(table, next);
    this.checkForeignKeys(table, next);
    rows[idx] = next;
    this.afterWrite();
    return structuredClone(next) as unknown as Row<T>;
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    this.beforeRead();
    this.removeInternal(table, id);
    this.afterWrite();
  }

  private removeInternal(table: TableName, id: string) {
    const rows = this.rows(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    // Check RESTRICT first so a failing delete leaves data unchanged.
    for (const fk of FOREIGN_KEYS.filter((f) => f.references === table && f.onDelete === "restrict")) {
      if (this.rows(fk.table).some((r) => r[fk.column] === id)) {
        throw new RepoError("foreign_key_violation", `${table} is referenced by ${fk.table}.${fk.column}`);
      }
    }
    rows.splice(idx, 1);
    for (const fk of FOREIGN_KEYS.filter((f) => f.references === table)) {
      const children = this.rows(fk.table).filter((r) => r[fk.column] === id);
      for (const child of children) {
        if (fk.onDelete === "cascade") this.removeInternal(fk.table, child.id);
        else if (fk.onDelete === "set null") child[fk.column] = null;
      }
    }
  }

  private checkUnique(table: TableName, row: AnyRow) {
    for (const cols of UNIQUE_KEYS[table] ?? []) {
      if (cols.some((c) => row[c] === null || row[c] === undefined)) continue;
      const clash = this.rows(table).find((r) => r.id !== row.id && cols.every((c) => r[c] === row[c]));
      if (clash) throw new RepoError("unique_violation", `Duplicate ${table}.${cols.join("+")}`, cols.join(","));
    }
  }

  private checkForeignKeys(table: TableName, row: AnyRow) {
    for (const fk of FOREIGN_KEYS.filter((f) => f.table === table)) {
      const v = row[fk.column];
      if (v === null || v === undefined) continue;
      if (!this.rows(fk.references).some((r) => r.id === v)) {
        throw new RepoError("foreign_key_violation", `${table}.${fk.column} → ${fk.references} missing`);
      }
    }
  }
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
