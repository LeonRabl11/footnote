import 'server-only';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '@/lib/env';
import * as schema from './schema';

// Typisierter DB-Client über den Neon-Serverless-Treiber (HTTP).
// Regel: JEDER Datenbankzugriff läuft über diesen `db`-Client (Drizzle).
const sql = neon(env.DATABASE_URL);

export const db = drizzle({ client: sql, schema });
