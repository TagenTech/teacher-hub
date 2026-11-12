import { join } from 'path';

export const TABLE_PREFIX = 'turmei_';

/** Opções do Postgres aceitas por TypeOrmModule/DataSource (evita import profundo do typeorm). */
export interface DatabaseOptions {
  type: 'postgres';
  url: string;
  ssl: false | { rejectUnauthorized: boolean };
  entityPrefix: string;
  migrationsTableName: string;
  uuidExtension: 'pgcrypto' | 'uuid-ossp';
  migrations: string[];
  extra: { max: number };
}

export function getDatabaseOptions(url: string): DatabaseOptions {
  return {
    type: 'postgres',
    url,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entityPrefix: TABLE_PREFIX,
    migrationsTableName: 'turmei_migrations',
    uuidExtension: 'pgcrypto',
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    extra: { max: Number(process.env.DB_POOL_MAX ?? 10) },
  };
}
