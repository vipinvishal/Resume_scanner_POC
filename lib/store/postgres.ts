import type { DbConfig } from "../types";
import { addedColumns, ddl, insertSql, numbered } from "./schema";
import type { Driver, Row } from "./types";

export async function openPostgres(cfg: DbConfig): Promise<Driver> {
  const mod = await import("pg");
  const { Pool } = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const pool = new Pool({
    host: cfg.host,
    port: cfg.port || 5432,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    // Company databases often use an internal certificate, so encrypt but don't insist it is publicly signed.
    ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 8000,
    max: 5,
  });
  pool.on("error", () => {}); // an idle connection dropping must not crash the server
  await pool.query("SELECT 1").catch(async (e) => {
    await pool.end().catch(() => {});
    throw e; // fail early, with the real reason
  });

  return {
    async all<T = Row>(sql: string, params?: unknown[]) {
      return (await pool.query(numbered(sql, "$"), params ?? [])).rows as T[];
    },
    async run(sql, params) {
      await pool.query(numbered(sql, "$"), params ?? []);
    },
    async insert(table, values) {
      const { sql, params } = insertSql(table, values, "", " RETURNING id");
      return Number((await pool.query(numbered(sql, "$"), params)).rows[0].id);
    },
    async migrate() {
      for (const s of ddl("postgres")) await pool.query(s);
      for (const c of addedColumns("postgres")) await pool.query(`ALTER TABLE ${c.table} ADD COLUMN IF NOT EXISTS ${c.column} ${c.def}`);
    },
    limit: (n, offset = 0) => ` LIMIT ${Math.floor(n)} OFFSET ${Math.floor(offset)}`,
    async close() {
      await pool.end();
    },
  };
}
