import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import config from './config';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] error inesperado en el pool:', err.message);
});

/**
 * Ejecuta una consulta y devuelve el resultado de `pg`.
 * @param text   Consulta SQL (preferiblemente parametrizada: $1, $2, ...)
 * @param params Valores de los parámetros
 *
 * El tipo `T` describe la forma de cada fila: `db.query<Producto>(...)`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
