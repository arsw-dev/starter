import { env } from 'cloudflare:workers';

import { connect } from '@arsw/start-hono/server';

import type { AppType } from '@arsw/todos-api/client';

// todos-api, over the service binding; only server functions' handlers use it
const call = connect<AppType>(() => env.TODOS_API, {
  name: 'todos-api',
});

export { call };
