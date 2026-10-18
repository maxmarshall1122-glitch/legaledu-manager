import type { Row, TableName } from "@/lib/types";

export interface Query<R> {
  eq?: Partial<Record<keyof R & string, string | number | boolean | null>>;
  in?: { column: keyof R & string; values: (string | number)[] };
  order?: { column: keyof R & string; ascending?: boolean };
  limit?: number;
}

/** Insert payload: id and timestamps are generated when omitted. */
export type NewRow<T extends TableName> = Omit<Row<T>, "id" | "created_at" | "updated_at"> &
  Partial<Pick<Row<T>, "id" & keyof Row<T>>>;

export type RepoErrorCode = "unique_violation" | "foreign_key_violation" | "not_found" | "permission_denied" | "unknown";

export class RepoError extends Error {
  constructor(
    public code: RepoErrorCode,
    message: string,
    public detail?: string,
  ) {
    super(message);
    this.name = "RepoError";
  }
}

/**
 * Minimal table-store abstraction. Business rules and authorization live in
 * src/lib/services; RLS in Supabase is an additional, independent safeguard.
 */
export interface Repo {
  readonly kind: "memory" | "file" | "supabase";
  list<T extends TableName>(table: T, query?: Query<Row<T>>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
}

export async function findOne<T extends TableName>(repo: Repo, table: T, eq: Query<Row<T>>["eq"]): Promise<Row<T> | null> {
  const rows = await repo.list(table, { eq, limit: 1 });
  return rows[0] ?? null;
}
