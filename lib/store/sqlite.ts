import fs from "node:fs";
import path from "node:path";
import type { DbConfig } from "../types";
import { addedColumns, ddl, insertSql } from "./schema";
import type { Driver, Row } from "./types";

/** SQLite via the driver built into Node (22.13+): nothing to install, one file on disk. */
export async function openSqlite(cfg: DbConfig): Promise<Driver> {
  const { DatabaseSync } = await import("node:sqlite");
  const file = path.resolve(process.cwd(), cfg.file || "data/talentlens.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");

  const bind = (p: unknown[] = []) => p.map((v) => (v === undefined ? null : v)) as (string | number | null)[];
  return {
    async all<T = Row>(sql: string, params?: unknown[]) {
      return db.prepare(sql).all(...bind(params)) as T[];
    },
    async run(sql, params) {
      db.prepare(sql).run(...bind(params));
    },
    async insert(table, values) {
      const { sql, params } = insertSql(table, values);
      return Number(db.prepare(sql).run(...bind(params)).lastInsertRowid);
    },
    async migrate() {
      for (const s of ddl("sqlite")) db.exec(s);
      for (const c of addedColumns("sqlite")) {
        const have = db.prepare(`PRAGMA table_info(${c.table})`).all() as { name: string }[];
        if (!have.some((h) => h.name === c.column)) db.exec(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.def}`);
      }
    },
    limit: (n, offset = 0) => ` LIMIT ${Math.floor(n)} OFFSET ${Math.floor(offset)}`,
    async close() {
      db.close();
    },
  };
}
