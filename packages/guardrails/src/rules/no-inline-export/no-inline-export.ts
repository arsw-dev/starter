import type { Rule } from '#/rules/rule.types.ts';

// A file's exports are listed once, at the end, so they're all in one place
const noInlineExport: Rule = {
  meta: {
    type: 'suggestion',
    messages: {
      inline:
        'Declare it, then export it at the end of the file: export { name } or export type { Name }',
    },
  },
  create: (ctx) => ({
    ExportNamedDeclaration: (node) => {
      if (!node.declaration) return;

      ctx.report({
        node,
        messageId: 'inline',
      });
    },
  }),
};

export { noInlineExport };
