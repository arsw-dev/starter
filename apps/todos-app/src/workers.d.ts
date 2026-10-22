// The bindings the app uses, typed by hand: wrangler types would bring the
// Workers runtime's own Request and Response, which clash with the DOM's the
// app is checked against
declare module 'cloudflare:workers' {
  import type { ServiceBinding } from '@arsw/start-hono/server';

  const env: {
    TODOS_API: ServiceBinding;
  };

  export { env };
}
