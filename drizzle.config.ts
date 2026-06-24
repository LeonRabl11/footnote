import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit (CLI) lädt .env nicht selbst -> oben via dotenv eingelesen.
// Migrations landen in ./drizzle, das Schema liegt unter src/lib/db/schema.ts.
export default defineConfig({
  out: './drizzle',
  schema: './src/lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
