import type { DbConfig, DbType } from "../types";

/** A problem with a ready-made message for HR, so callers show it as written instead of wrapping it. */
export class FriendlyDbError extends Error {}

/** Letters, numbers, underscore and hyphen, starting with a letter or underscore. Anything else is never put into SQL. */
const SAFE_NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/;

type DbError = { code?: string; errno?: number; number?: number; message?: string; originalError?: { info?: { number?: number } } };

/** Did the connection fail only because that database doesn't exist yet? */
export function isMissingDatabase(type: DbType, e: unknown): boolean {
  const err = e as DbError;
  switch (type) {
    case "postgres":
      return err.code === "3D000"; // invalid_catalog_name
    case "mysql":
      // 1049 = unknown database. A login with no rights on a database that doesn't exist yet gets
      // 1044 ("access denied to database") instead, so treat that as "maybe missing" too.
      return err.code === "ER_BAD_DB_ERROR" || err.errno === 1049 || err.errno === 1044;
    case "mssql":
      return /Cannot open database/i.test(err.message ?? "") || err.originalError?.info?.number === 4060;
    default:
      return false;
  }
}

const denied = (type: DbType, e: unknown) => {
  const err = e as DbError;
  const m = err.message ?? "";
  return (
    (type === "postgres" && (err.code === "42501" || /permission denied/i.test(m))) ||
    (type === "mysql" && (err.errno === 1044 || err.errno === 1227 || /denied to user/i.test(m) && !/using password/i.test(m))) ||
    (type === "mssql" && /permission.*denied|denied/i.test(m) && /CREATE DATABASE/i.test(m))
  );
};

/**
 * Create the empty database named in the settings, so HR never has to open a database tool.
 * Connects to the server's own maintenance database with the same login. The name is checked
 * against a strict pattern first and quoted, so it can't be used to run other SQL.
 */
export async function createDatabase(cfg: DbConfig): Promise<void> {
  const name = cfg.database;
  if (!SAFE_NAME.test(name))
    throw new FriendlyDbError(
      `The database "${name}" doesn't exist, and that name can't be created automatically. Use letters, numbers, underscores or hyphens (starting with a letter), or ask your database admin to create it.`,
    );

  try {
    if (cfg.type === "postgres") {
      const mod = await import("pg");
      const { Client } = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const connect = async (database: string) => {
        const c = new Client({ host: cfg.host, port: cfg.port || 5432, user: cfg.user, password: cfg.password, database, ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 8000 });
        c.on("error", () => {});
        await c.connect();
        return c;
      };
      const c = await connect("postgres").catch(() => connect("template1"));
      try {
        if (!(await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [name])).rowCount) {
          try {
            // UTF-8 with the neutral "C" locale works on every install (Windows ones default to a legacy encoding that can't store all names).
            await c.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
          } catch (e) {
            if (denied("postgres", e)) throw e;
            await c.query(`CREATE DATABASE "${name}"`); // some setups reject the options above; the plain form still works
          }
        }
      } finally {
        await c.end().catch(() => {});
      }
    } else if (cfg.type === "mysql") {
      const mod = await import("mysql2/promise");
      const mysql = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const c = await mysql.createConnection({ host: cfg.host, port: cfg.port || 3306, user: cfg.user, password: cfg.password, ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined, connectTimeout: 8000 });
      try {
        await c.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      } finally {
        await c.end().catch(() => {});
      }
    } else if (cfg.type === "mssql") {
      const mod = await import("mssql");
      const sql = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const pool = new sql.ConnectionPool({ server: cfg.host, port: cfg.port || 1433, database: "master", user: cfg.user, password: cfg.password, options: { encrypt: cfg.ssl, trustServerCertificate: true }, connectionTimeout: 8000 });
      pool.on("error", () => {});
      await pool.connect();
      try {
        await pool.request().query(`IF DB_ID(N'${name}') IS NULL CREATE DATABASE [${name}]`);
      } finally {
        await pool.close().catch(() => {});
      }
    }
  } catch (e) {
    if (e instanceof FriendlyDbError) throw e;
    if (denied(cfg.type, e) && cfg.type === "mysql")
      throw new FriendlyDbError(
        `The login "${cfg.user}" can't use the database "${name}": it either doesn't exist yet or the login has no access to it, and the login isn't allowed to create databases. ` +
          `Ask your database admin to create an empty database called "${name}" and give "${cfg.user}" access to it, or use a login that can create databases (often "root").`,
      );
    if (denied(cfg.type, e))
      throw new FriendlyDbError(
        `The database "${name}" doesn't exist yet, and the login "${cfg.user}" isn't allowed to create databases. ` +
          `Use a login that can (for PostgreSQL that is usually "postgres"), or ask your database admin to create an empty database called "${name}".`,
      );
    throw e;
  }
}
