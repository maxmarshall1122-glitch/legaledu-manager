import type { SupabaseClient } from "@supabase/supabase-js";
import type { Row, TableName } from "@/lib/types";
import { RepoError, type NewRow, type Query, type Repo } from "./repo";

const PAGE = 1000;
const IN_CHUNK = 100;

function mapError(error: { code?: string; message: string; details?: string | null }): RepoError {
  switch (error.code) {
    case "23505":
      return new RepoError("unique_violation", "Duplicate value", error.details ?? undefined);
    case "23503":
      return new RepoError("foreign_key_violation", "Related record constraint", error.details ?? undefined);
    case "42501":
      return new RepoError("permission_denied", "Permission denied");
    case "22P02": // invalid input syntax (e.g. malformed uuid)
    case "PGRST116":
      return new RepoError("not_found", "Not found");
    default:
      return new RepoError("unknown", "Database error");
  }
}

/**
 * Supabase/PostgreSQL repository. It is constructed with the *signed-in user's*
 * client, so every query is additionally filtered by row-level security.
 */
export class SupabaseRepo implements Repo {
  readonly kind = "supabase" as const;
  constructor(private client: SupabaseClient) {}

  async list<T extends TableName>(table: T, query: Query<Row<T>> = {}): Promise<Row<T>[]> {
    // PostgREST filters travel in the URL; split long IN lists into chunks.
    if (query.in && query.in.values.length > IN_CHUNK) {
      const chunks: Row<T>[][] = [];
      for (let i = 0; i < query.in.values.length; i += IN_CHUNK) {
        chunks.push(await this.list(table, { ...query, limit: undefined, in: { ...query.in, values: query.in.values.slice(i, i + IN_CHUNK) } }));
      }
      let merged = chunks.flat();
      if (query.order) {
        const { column, ascending = true } = query.order;
        merged = merged.sort((a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")) * (ascending ? 1 : -1));
      }
      return query.limit !== undefined ? merged.slice(0, query.limit) : merged;
    }
    const out: Row<T>[] = [];
    const max = query.limit ?? Number.POSITIVE_INFINITY;
    for (let from = 0; out.length < max; from += PAGE) {
      let q = this.client.from(table).select("*");
      for (const [k, v] of Object.entries(query.eq ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v as string);
      if (query.in) {
        if (query.in.values.length === 0) return [];
        q = q.in(query.in.column as string, query.in.values as never[]);
      }
      if (query.order) q = q.order(query.order.column, { ascending: query.order.ascending ?? true });
      else q = q.order("id");
      const to = from + Math.min(PAGE, max - out.length) - 1;
      const { data, error } = await q.range(from, to);
      if (error) throw mapError(error);
      out.push(...((data ?? []) as Row<T>[]));
      if (!data || data.length < to - from + 1) break;
    }
    return out;
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw mapError(error);
    return (data as Row<T>) ?? null;
  }

  async insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
    const { data, error } = await this.client.from(table).insert(row as never).select("*").single();
    if (error) throw mapError(error);
    return data as Row<T>;
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const { id: _id, created_at: _c, ...rest } = patch as Record<string, unknown>;
    void _id;
    void _c;
    const { data, error } = await this.client.from(table).update(rest as never).eq("id", id).select("*").single();
    if (error) throw mapError(error);
    return data as Row<T>;
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq("id", id);
    if (error) throw mapError(error);
  }
}
