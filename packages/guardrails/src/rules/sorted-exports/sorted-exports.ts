import type { Rule } from '#/rules/rule.types.ts';

// What the rule reads of an export's specifier: an identifier, or a string
// name (export { a as 'b' })
type Specifier = {
  range: [number, number];
  exported:
    | {
        type: 'Identifier';
        name: string;
      }
    | {
        type: 'Literal';
        value: string;
      };
};

const nameOf = (specifier: Specifier) =>
  specifier.exported.type === 'Identifier'
    ? specifier.exported.name
    : specifier.exported.value;

// By character code, as sort-imports orders an import's names, so an export
// list and an import list sort alike: capitals before lowercase
const byName = (a: Specifier, b: Specifier) => {
  const x = nameOf(a);
  const y = nameOf(b);

  if (x === y) return 0;

  return x < y ? -1 : 1;
};

// An export list in order, like the imports at the top of the file, so a name
// is found where it would be and two lists never differ only by their order
const sortedExports: Rule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    messages: {
      order: 'Sort the exported names, as imports are: {{expected}}',
    },
  },
  create: (ctx) => ({
    ExportNamedDeclaration: (node) => {
      const specifiers: Specifier[] = node.specifiers;
      const sorted = specifiers.toSorted(byName);

      if (sorted.every((specifier, i) => specifier === specifiers[i])) return;

      const first = specifiers[0];
      const last = specifiers.at(-1);

      if (!first || !last) return;

      const range: [number, number] = [first.range[0], last.range[1]];

      // A comment between the names has no right place once they move
      const commented = ctx.sourceCode
        .getAllComments()
        .some((c) => c.range[0] > range[0] && c.range[1] < range[1]);

      ctx.report({
        node,
        messageId: 'order',
        data: {
          expected: sorted.map(nameOf).join(', '),
        },
        ...(commented
          ? {}
          : {
              fix: (fixer) =>
                fixer.replaceTextRange(
                  range,
                  sorted
                    .map((s) => ctx.sourceCode.text.slice(...s.range))
                    .join(', '),
                ),
            }),
      });
    },
  }),
};

export { sortedExports };
