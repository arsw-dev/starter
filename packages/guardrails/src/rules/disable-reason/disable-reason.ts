import type { Rule } from '#/rules/rule.types.ts';

// A disable directive: `oxlint-disable`, `-line` or `-next-line` (and
// eslint-'s, in case one is copied in), then the end of the comment or the
// rule names. `-enable` needs no reason
const DIRECTIVE = /^\s*(?:oxlint|eslint)-disable(?:-next-line|-line)?(?:\s|$)/;

// The reason, after the rule names: ` -- ` and some text
const REASON = /\s--\s+\S/;

// Turning a rule off says why, in the same comment:
// `// oxlint-disable-next-line <rule> -- <why>`. A reason makes a disable a
// decision someone can read and question, not a way around a rule
const disableReason: Rule = {
  meta: {
    type: 'suggestion',
    messages: {
      reason: 'Say why the rule is off, after the rule names: -- <why>',
    },
  },
  create: (ctx) => ({
    Program: () => {
      for (const comment of ctx.sourceCode.getAllComments()) {
        if (!DIRECTIVE.test(comment.value)) continue;
        if (REASON.test(comment.value)) continue;

        ctx.report({
          loc: comment.loc,
          messageId: 'reason',
        });
      }
    },
  }),
};

export { disableReason };
