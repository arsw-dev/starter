import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import type { Rule } from '#/rules/rule.types.ts';

type Source = {
  type: string;
  value?: unknown;
  range: [number, number];
} | null;

// The folder holding a file's package.json: its #/ imports map to that
// folder's src/
const packageRoot = (file: string) => {
  for (let folder = dirname(file); folder !== dirname(folder);) {
    if (existsSync(join(folder, 'package.json'))) return folder;

    folder = dirname(folder);
  }

  return undefined;
};

// Whether target is in folder or a folder below it
const within = (target: string, folder: string) =>
  target === folder || target.startsWith(`${folder}${sep}`);

// `./` for a file in the same folder or below it, `#/` for anything else, so
// moving a folder only changes the imports that cross its edge.
// import/no-relative-parent-imports stops `../`; this is the other half
const importPath: Rule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    messages: {
      local: "Import from this file's folder or below with ./, not #/",
    },
  },
  create: (ctx) => {
    const file = resolve(ctx.filename);
    const root = packageRoot(file);

    const check = (source: Source) => {
      if (!root || source?.type !== 'Literal') return;
      if (typeof source.value !== 'string') return;
      if (!source.value.startsWith('#/')) return;

      const target = join(root, 'src', source.value.slice('#/'.length));

      if (!within(dirname(target), dirname(file))) return;

      const local = relative(dirname(file), target).split(sep).join('/');

      ctx.report({
        loc: ctx.sourceCode.getLocFromIndex(source.range[0]),
        messageId: 'local',
        fix: (fixer) => fixer.replaceTextRange(source.range, `'./${local}'`),
      });
    };

    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
    };
  },
};

export { importPath };
