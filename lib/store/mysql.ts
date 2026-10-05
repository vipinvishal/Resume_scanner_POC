import type { DbConfig } from "../types";
import { addedColumns, ddl, insertSql } from "./schema";
import type { Driver, Row } from "./types";

/** MySQL and MariaDB. */
export async function openMysql(cfg: DbConfig): Promise<Driver> {
  const mod = await import("mysql2/promise");
  const mysql = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port || 3306,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
    charset: "utf8mb4",
    connectTimeout: 8000,
    connectionLimit: 5,
  });
  await pool.query("SELECT 1").catch(async (e) => {
    await pool.end().catch(() => {});
    throw e; // fail early, with the real reason
  });

  return {
    async all<T = Row>(sql: string, params?: unknown[]) {
      const [rows] = await pool.query(sql, params ?? []);
      return rows as T[];
    },
    async run(sql, params) {
      await pool.query(sql, params ?? []);
    },
    async insert(table, values) {
      const { sql, params } = insertSql(table, values);
      const [res] = await pool.query(sql, params);
      return Number((res as { insertId: number }).insertId);
    },
    async migrate() {
      for (const s of ddl("mysql")) await pool.query(s);
      for (const c of addedColumns("mysql")) {
        const [rows] = await pool.query(
          "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
          [c.table, c.column],
        );
        if (!Number((rows as { n: number }[])[0].n)) await pool.query(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.def}`);
      }
    },
    limit: (n, offset = 0) => ` LIMIT ${Math.floor(n)} OFFSET ${Math.floor(offset)}`,
    async close() {
      await pool.end();
    },
  };
}
