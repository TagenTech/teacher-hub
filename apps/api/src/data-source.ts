/**
 * DataSource para a CLI do TypeORM (migrations).
 *   pnpm --filter @turmei/api migration:generate src/migrations/NomeDaMudanca
 *   pnpm --filter @turmei/api migration:run
 */
import 'dotenv/config';
import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/gestao_aulas',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
