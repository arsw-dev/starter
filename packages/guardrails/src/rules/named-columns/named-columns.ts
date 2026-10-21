import type { Rule } from '#/rules/rule.types.ts';

// Drizzle's calls that take every column when given none
const WHOLE_ROW = new Set(['select', 'selectDistinct', 'returning']);

// A query names its columns. A whole row carries pk and fields no one may read,
// and still type-checks against a response schema, which strips nothing, so a
// select() or returning() with no columns is how they'd reach a client
const namedColumns: Rule = {
  meta: {
    type: 'problem',
    messages: {
      whole:
        'Name the columns: {{method}}(model.readColumns), so pk and unread fields stay in the database',
    },
  },
  create: (ctx) => ({
    CallExpression: (node) => {
      if (node.arguments.length > 0) return;
      if (node.callee.type !== 'MemberExpression') return;
      if (node.callee.property.type !== 'Identifier') return;
      if (!WHOLE_ROW.has(node.callee.property.name)) return;

      ctx.report({
        node: node.callee.property,
        messageId: 'whole',
        data: {
          method: node.callee.property.name,
        },
      });
    },
  }),
};

export { namedColumns };
