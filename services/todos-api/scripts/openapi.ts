import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import app from '#/main.ts';

// The API's OpenAPI document, written to a committed file rather than served:
// an API publishes it only by choice. CI regenerates it, so a change to the API
// arrives with the change to its contract
const document = app.getOpenAPI31Document({
  openapi: '3.1.0',
  info: {
    title: 'Todos API',
    version: '1.0.0',
  },
});

await writeFile(
  path.join(import.meta.dirname, '..', 'openapi.json'),
  `${JSON.stringify(document, null, 2)}\n`,
);
