import type pg from 'pg';
export function runMigrations(
  db: pg.Pool | pg.Client,
  options?: { log?: (msg: string) => void },
): Promise<string[]>;
