import { readFile, rm, writeFile } from 'node:fs/promises';

import { z } from '@hono/zod-openapi';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { createApp } from '#/app/app.ts';
import { runDocument } from '#/document/document.command.ts';
import { defineRoute } from '#/http/http.route.ts';

const listItems = defineRoute({
  method: 'get',
  path: '/',
  response: z.array(z.string()),
  description: 'All items',
  policy: 'read',
  handler: (c) => c.json([], 200),
});

const createItem = defineRoute({
  method: 'post',
  path: '/',
  body: z.object({
    title: z.string(),
  }),
  status: 201,
  response: z.string(),
  description: 'Item created',
  policy: 'write',
  handler: (c) => c.json(c.req.valid('json').title, 201),
});

const routes = {
  '/items': {
    listItems,
    createItem,
  },
};

const policy = {
  enforce: () => undefined,
};

const app = createApp({
  document: {
    title: 'Items API',
    version: '1.2.0',
  },
  policy,
  routes,
});

// workerd's own file system, which a test writes to as the command would
const out = '/tmp/docs/openapi.json';

const run = async (check: boolean, to: unknown = app) =>
  runDocument({
    entry: 'src/main.ts',
    app: to,
    out,
    check,
  });

beforeEach(async () => {
  await rm('/tmp/docs', {
    recursive: true,
    force: true,
  });
});

describe('kiln document', () => {
  it("writes the app's OpenAPI 3.1 document, with its title and version", async () => {
    expect(await run(false)).toEqual({
      ok: true,
      message: `Wrote ${out}`,
    });
    expect(JSON.parse(await readFile(out, 'utf8'))).toEqual(
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
    await run(false);

    const written = await readFile(out, 'utf8');

    expect(written).toMatch(/^\{\n {2}"openapi": "3\.1\.0",\n/);
    expect(written.endsWith('}\n')).toBe(true);
  });

  it("writes each route's policy as x-policy", async () => {
    await run(false);

    const { paths } = JSON.parse(await readFile(out, 'utf8'));

    expect([
      paths['/items'].get['x-policy'],
      paths['/items'].post['x-policy'],
    ]).toEqual(['read', 'write']);
  });

  it('fails, saying so, for an app with no document, or no app', async () => {
    const undocumented = createApp({
      policy,
      routes,
    });

    expect(
      await Promise.all([run(false, undocumented), run(false, {})]),
    ).toEqual([
      {
        ok: false,
        message:
          "src/main.ts's app has no document: give createApp a document, { title, version }",
      },
      {
        ok: false,
        message:
          'src/main.ts does not export an app as its default: export default createApp({ … })',
      },
    ]);
  });
});

describe('kiln document --check', () => {
  it('passes on the document it wrote, writing nothing', async () => {
    await run(false);

    const written = await readFile(out, 'utf8');

    expect(await run(true)).toEqual({
      ok: true,
      message: `${out} is the app's document`,
    });
    expect(await readFile(out, 'utf8')).toBe(written);
  });

  it('fails on a missing one, naming it', async () => {
    expect(await run(true)).toEqual({
      ok: false,
      message: `${out} is missing: run kiln document to write it`,
    });
  });

  it('fails on a stale one, naming it and showing what differs', async () => {
    await run(false);

    const document = JSON.parse(await readFile(out, 'utf8'));

    document.info.version = '1.1.0';
    delete document.paths['/items'].post;
    document.paths['/old'] = {};
    await writeFile(out, `${JSON.stringify(document, null, 2)}\n`);

    expect(await run(true)).toEqual({
      ok: false,
      message: [
        `${out} is not the app's document (+ only in the app's, - only in the file, ~ different):`,
        '  ~ info.version: "1.1.0" -> "1.2.0"',
        '  + paths./items.post',
        '  - paths./old',
        'Run kiln document to write it',
      ].join('\n'),
    });
  });

  it('fails on one laid out otherwise, or not JSON', async () => {
    await run(false);

    const written = await readFile(out, 'utf8');

    await writeFile(out, JSON.stringify(JSON.parse(written)));

    const unindented = await run(true);

    await writeFile(out, '{');

    expect([unindented, await run(true)]).toEqual([
      {
        ok: false,
        message: `${out} is not laid out as kiln document writes it\nRun kiln document to write it`,
      },
      {
        ok: false,
        message: `${out} is not valid JSON\nRun kiln document to write it`,
      },
    ]);
  });
});
