export type Row = Record<string, unknown>;

/**
 * The only thing the app needs from a database. SQL is written once with `?` placeholders;
 * each driver turns that into its own flavour and handles the few things that differ (auto-ids, big text).
 */
export interface Driver {
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<void>;
  /** Insert one row and return its new auto-generated `id`. */
  insert(table: string, values: Row): Promise<number>;
  /** Create the tables if they don't exist yet. Safe to run on every start. */
  migrate(): Promise<void>;
  /** The row-limiting tail for a SELECT ... ORDER BY query (this differs between databases). */
  limit(n: number, offset?: number): string;
  close(): Promise<void>;
}

export const TABLES = { jobs: "tl_jobs", candidates: "tl_candidates", history: "tl_history", audit: "tl_audit" } as const;
