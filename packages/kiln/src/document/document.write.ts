import { writeFile } from 'node:fs/promises';

import type { OpenAPIHono } from '@hono/zod-openapi';

type DocumentOptions = {
  title: string;
  version: string;
  // Where it's written: a path, or a URL such as
  // new URL('../docs/openapi.json', import.meta.url)
  file: string | URL;
};

// An app's OpenAPI document, written to a file rather than served: an API
// publishes it only by choice. Node only, never the core, which runs in Workers
const writeDocument = async (
  app: Pick<OpenAPIHono, 'getOpenAPI31Document'>,
  { title, version, file }: DocumentOptions,
) => {
  const document = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title,
      version,
    },
  });

  await writeFile(file, `${JSON.stringify(document, null, 2)}\n`);
};

export { writeDocument };
export type { DocumentOptions };
