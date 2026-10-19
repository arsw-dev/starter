import type { Rule } from '#/rules/rule.types.ts';

// A statement, as the visitors hand them over: oxlint doesn't export its node
// types by name. A file's top level also holds imports and exports
type Visitor = ReturnType<NonNullable<Rule['create']>>;
type Node = Parameters<NonNullable<Visitor['Program']>>[0]['body'][number];

// Statements that hold a block of their own
const BLOCKS = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'TryStatement',
  'SwitchStatement',
  'BlockStatement',
]);

// A function's steps read as paragraphs. The formatter keeps blank lines but
// never adds them, so this asks for them: before a return, around an if
// (consecutive one-line ifs stay together), and after a block that spans
// lines. The start and end of a list of statements need none
const breathe: Rule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    messages: {
      return: 'Put a blank line before a return that follows other statements',
      if: 'Put a blank line around an if, unless it joins a group of one-line ifs',
      block: 'Put a blank line after a block that spans lines',
    },
  },
  create: (ctx) => {
    const { sourceCode } = ctx;

    const line = (index: number) => sourceCode.getLocFromIndex(index).line;
    const oneLine = (node: Node) => line(node.range[0]) === line(node.range[1]);
    const guard = (node: Node) => node.type === 'IfStatement' && oneLine(node);

    const reason = (previous: Node, current: Node) => {
      if (current.type === 'ReturnStatement') return 'return';
      if (guard(previous) && guard(current)) return undefined;
      if (current.type === 'IfStatement') return 'if';
      if (previous.type === 'IfStatement') return 'if';
      if (BLOCKS.has(previous.type) && !oneLine(previous)) return 'block';

      return undefined;
    };

    const check = (body: Node[]) => {
      for (const [index, current] of body.entries()) {
        const previous = body[index - 1];

        if (!previous) continue;

        const messageId = reason(previous, current);

        if (!messageId) continue;

        // A comment on its own line above a statement belongs to it: the
        // blank line goes above the comment
        const ended = line(previous.range[1]);
        const above = sourceCode
          .getCommentsBefore(current)
          .map((comment) => line(comment.range[0]))
          .filter((start) => start > ended);
        const starts = Math.min(line(current.range[0]), ...above);

        if (starts - ended >= 2) continue;

        ctx.report({
          loc: sourceCode.getLocFromIndex(current.range[0]),
          messageId,
          fix: (fixer) => {
            const at = sourceCode.getIndexFromLoc({
              line: starts,
              column: 0,
            });

            return fixer.insertTextBeforeRange([at, at], '\n');
          },
        });
      }
    };

    return {
      Program: (node) => check(node.body),
      BlockStatement: (node) => check(node.body),
      StaticBlock: (node) => check(node.body),
      SwitchCase: (node) => check(node.consequent),
    };
  },
};

export { breathe };
