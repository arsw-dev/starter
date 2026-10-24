import { readFile } from 'node:fs/promises';

import { z } from '@hono/zod-openapi';
import { expect, it } from 'vite-plus/test';

import { createApp } from '#/app/app.ts';
import { writeDocument } from '#/document/document.write.ts';
import { defineRoute } from '#/http/http.route.ts';

const app = createApp({
  routes: {
    '/items': {
      listItems: defineRoute({
        method: 'get',
        path: '/',
        response: z.array(z.string()),
        description: 'All items',
        handler: (c) => c.json([], 200),
      }),
    },
  },
});

it('writes the app as an OpenAPI 3.1 document, with its title and version', async () => {
  await writeDocument(app, {
    title: 'Items API',
    version: '1.2.0',
    file: '/tmp/openapi.json',
  });

  expect(JSON.parse(await readFile('/tmp/openapi.json', 'utf8'))).toEqual(
    app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: {
        title: 'Items API',
        version: '1.2.0',
      },
    }),
  );
});

it('writes it as a file is committed: indented, ending in a newline', async () => {
  await writeDocument(app, {
    title: 'Items API',
    version: '1.2.0',
    file: new URL('file:///tmp/openapi-url.json'),
  });

  const written = await readFile('/tmp/openapi-url.json', 'utf8');

  expect(written).toMatch(/^\{\n {2}"openapi": "3\.1\.0",\n/);
  expect(written.endsWith('}\n')).toBe(true);
});
