#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { runDocument } from './document/document.command.ts';

// kiln, the package's command, in Node only: it loads the API's app, which the
// core never does
const USAGE =
  'Usage: kiln document [--entry src/main.ts] [--out docs/openapi.json] [--check]';

const parse = () => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        entry: {
          type: 'string',
          default: 'src/main.ts',
        },
        out: {
          type: 'string',
          default: 'docs/openapi.json',
        },
        check: {
          type: 'boolean',
          default: false,
        },
      },
    });
  } catch {
    return undefined;
  }
};

const args = parse();

if (args?.positionals.length !== 1 || args.positionals[0] !== 'document') {
  console.error(USAGE);
  process.exitCode = 1;
} else {
  const { entry, out, check } = args.values;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a module's namespace: whatever it exports, its default is checked before it's used
  const loaded = (await import(pathToFileURL(path.resolve(entry)).href)) as {
    default?: unknown;
  };
  const { ok, message } = await runDocument({
    entry,
    app: loaded.default,
    out,
    check,
  });

  if (ok) {
    console.log(message);
  } else {
    console.error(message);
    process.exitCode = 1;
  }
}
