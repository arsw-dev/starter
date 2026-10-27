import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { toChanges } from './document.changes.ts';
import { toDocument } from './document.info.ts';

type Options = {
  // The API's entry, whose default export is its app, as given: for messages
  entry: string;
  // What it exports as its default
  app: unknown;
  // Where the document is written, as given
  out: string;
  // Compare the file with the app's document, writing nothing
  check: boolean;
};

type Outcome = {
  ok: boolean;
  message: string;
};

// The most differences a failed check lists: enough to see what changed
const SHOWN = 20;

// The document as it's committed: indented, ending in a newline
const toText = (document: object) => `${JSON.stringify(document, null, 2)}\n`;

const isApp = (app: unknown): app is Parameters<typeof toDocument>[0] =>
  typeof app === 'object' &&
  app !== null &&
  'getOpenAPI31Document' in app &&
  typeof app.getOpenAPI31Document === 'function';

const readText = async (file: string) => {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
};

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

// Why a written document isn't the app's: what differs, or that it isn't JSON,
// or isn't laid out as kiln document writes it. The app's is compared as it
// would be written, since JSON leaves out what's undefined in it
const toStale = (out: string, text: string, current: string) => {
  const written = parsed(text);

  if (written === undefined) return `${out} is not valid JSON`;

  const changes = toChanges(written, parsed(current));

  if (changes.length === 0) {
    return `${out} is not laid out as kiln document writes it`;
  }

  return [
    `${out} is not the app's document (+ only in the app's, - only in the file, ~ different):`,
    ...changes.slice(0, SHOWN).map((change) => `  ${change}`),
    ...(changes.length > SHOWN ? [`  and ${changes.length - SHOWN} more`] : []),
  ].join('\n');
};

// kiln document: the app's OpenAPI document, written to out, or with check,
// compared with what's there
const runDocument = async ({
  entry,
  app,
  out,
  check,
}: Options): Promise<Outcome> => {
  if (!isApp(app)) {
    return {
      ok: false,
      message: `${entry} does not export an app as its default: export default createApp({ … })`,
    };
  }

  const document = toDocument(app);

  if (!document) {
    return {
      ok: false,
      message: `${entry}'s app has no document: give createApp a document, { title, version }`,
    };
  }

  const text = toText(document);

  if (!check) {
    await mkdir(path.dirname(out), {
      recursive: true,
    });
    await writeFile(out, text);

    return {
      ok: true,
      message: `Wrote ${out}`,
    };
  }

  const written = await readText(out);

  if (written === undefined) {
    return {
      ok: false,
      message: `${out} is missing: run kiln document to write it`,
    };
  }

  if (written !== text) {
    return {
      ok: false,
      message: `${toStale(out, written, text)}\nRun kiln document to write it`,
    };
  }

  return {
    ok: true,
    message: `${out} is the app's document`,
  };
};

export { runDocument };
