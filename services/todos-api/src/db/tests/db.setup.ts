import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Before each test file. Applied migrations are recorded in d1_migrations, so
// each one runs once
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
