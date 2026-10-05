import type { DbConfig } from "../types";
import { addedColumns, ddl, insertSql, numbered } from "./schema";
import type { Driver, Row } from "./types";

export async function openMssql(cfg: DbConfig): Promise<Driver> {
  const mod = await import("mssql");
  const sql = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const pool = new sql.ConnectionPool({
    server: cfg.host,
    port: cfg.port || 1433,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    options: { encrypt: cfg.ssl, trustServerCertificate: true },
    connectionTimeout: 8000,
    pool: { max: 5 },
  });
  pool.on("error", () => {});
  await pool.connect().catch(async (e) => {
    await pool.close().catch(() => {});
    throw e; // fail early, with the real reason
  });

  const exec = async (text: string, params: unknown[] = []) => {
    const req = pool.request();
    params.forEach((v, i) => req.input(`p${i + 1}`, v));
    return req.query(numbered(text, "@p"));
  };

  return {
    async all<T = Row>(text: string, params?: unknown[]) {
      return ((await exec(text, params)).recordset ?? []) as T[];
    },
    async run(text, params) {
      await exec(text, params);
    },
    async insert(table, values) {
      const q = insertSql(table, values, " OUTPUT INSERTED.id");
      return Number((await exec(q.sql, q.params)).recordset[0].id);
    },
    async migrate() {
      for (const s of ddl("mssql")) await exec(s);
      for (const c of addedColumns("mssql")) await exec(`IF COL_LENGTH('${c.table}', '${c.column}') IS NULL ALTER TABLE ${c.table} ADD ${c.column} ${c.def}`);
    },
    // SQL Server pages with OFFSET/FETCH, which needs the query to have an ORDER BY.
    limit: (n, offset = 0) => ` OFFSET ${Math.floor(offset)} ROWS FETCH NEXT ${Math.floor(n)} ROWS ONLY`,
    async close() {
      await pool.close();
    },
  };
}
