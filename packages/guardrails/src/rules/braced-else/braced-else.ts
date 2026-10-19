import type { Rule } from '#/rules/rule.types.ts';

type Visitor = ReturnType<NonNullable<Rule['create']>>;
type If = Parameters<NonNullable<Visitor['IfStatement']>>[0];
type Branch = If['consequent'];

// A brace-less if is a one-line guard. Once there's an else, it's a choice
// between paths, and every branch gets braces however short it is
const bracedElse: Rule = {
  meta: {
    type: 'layout',
    fixable: 'code',
    messages: {
      braces: 'Put every branch of an if that has an else in braces',
    },
  },
  create: (ctx) => {
    const { sourceCode } = ctx;
    const seen = new WeakSet<If>();

    // The branches without braces, down the chain: each else if is an if of
    // its own, marked seen so its visit doesn't report the chain again
    const bare = (link: If): Branch[] => {
      seen.add(link);

      const own =
        link.consequent.type === 'BlockStatement' ? [] : [link.consequent];
      const next = link.alternate;

      if (!next) return own;
      if (next.type === 'IfStatement') return [...own, ...bare(next)];

      return next.type === 'BlockStatement' ? own : [...own, next];
    };

    return {
      IfStatement: (node) => {
        if (seen.has(node) || !node.alternate) return;

        const branches = bare(node);

        if (branches.length === 0) return;

        ctx.report({
          node,
          messageId: 'braces',
          fix: (fixer) =>
            branches.map((branch) =>
              fixer.replaceText(branch, `{\n${sourceCode.getText(branch)}\n}`),
            ),
        });
      },
    };
  },
};

export { bracedElse };
