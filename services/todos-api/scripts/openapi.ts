import { writeDocument } from '@arsw/kiln/document';

import app from '#/main.ts';

// The API's OpenAPI document, written to a committed file rather than served:
// an API publishes it only by choice. CI regenerates it, so a change to the API
// arrives with the change to its contract
await writeDocument(app, {
  title: 'Todos API',
  version: '1.0.0',
  file: new URL('../docs/openapi.json', import.meta.url),
});
