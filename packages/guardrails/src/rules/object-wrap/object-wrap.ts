import type { Rule } from '#/rules/rule.types.ts';

type Ranged = {
  range: [number, number];
};

const objectWrap: Rule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    messages: {
      wrap: 'Put each member on its own line',
    },
  },
  create: (ctx) => {
    const check = (node: Ranged, first: Ranged | undefined) => {
      if (!first) return;

      const open = ctx.sourceCode.getLocFromIndex(node.range[0]).line;
      const start = ctx.sourceCode.getLocFromIndex(first.range[0]).line;

      if (open !== start) return;

      ctx.report({
        node,
        messageId: 'wrap',
        fix: (fixer) =>
          fixer.insertTextAfterRange([node.range[0], node.range[0] + 1], '\n'),
      });
    };

    return {
      ObjectExpression: (node) => check(node, node.properties[0]),
      TSTypeLiteral: (node) => check(node, node.members[0]),
    };
  },
};

export { objectWrap };
