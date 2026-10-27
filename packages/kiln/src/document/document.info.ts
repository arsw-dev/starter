import type { OpenAPIHono } from '@hono/zod-openapi';

// What an app's document says about it, in its info
type DocumentInfo = {
  title: string;
  version: string;
};

// Each app's info, kept beside it rather than on it, so the app's type is
// Hono's own
const infos = new WeakMap<object, DocumentInfo>();

const setDocumentInfo = (app: object, info: DocumentInfo) => {
  infos.set(app, info);
};

// An app's OpenAPI 3.1 document, or undefined for one that wasn't given its
// info
const toDocument = (
  app: Pick<OpenAPIHono, 'getOpenAPI31Document'>,
): ReturnType<OpenAPIHono['getOpenAPI31Document']> | undefined => {
  const info = infos.get(app);

  return (
    info &&
    app.getOpenAPI31Document({
      openapi: '3.1.0',
      info,
    })
  );
};

export { setDocumentInfo, toDocument };
export type { DocumentInfo };
