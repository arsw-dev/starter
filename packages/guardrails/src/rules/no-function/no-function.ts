import type { Rule } from '#/rules/rule.types.ts';

type Parent = {
  type: string;
  method?: boolean;
  kind?: string;
};

// Class and object methods, getters and setters: the function keyword is part
// of their syntax
const isMethod = (parent: Parent) =>
  parent.type === 'MethodDefinition' ||
  parent.type === 'TSAbstractMethodDefinition' ||
  (parent.type === 'Property' && (parent.method || parent.kind !== 'init'));

// Arrow functions only. The function keyword stays where an arrow can't
// replace it: methods (above) and generators. Overload signatures
// (`function f(a: string): void;`) aren't functions here
const noFunction: Rule = {
  meta: {
    type: 'suggestion',
    messages: {
      arrow: 'Use an arrow function: const name = () => …',
    },
  },
  create: (ctx) => ({
    FunctionDeclaration: (node) => {
      if (node.generator) return;

      ctx.report({
        node,
        messageId: 'arrow',
      });
    },
    FunctionExpression: (node) => {
      if (node.generator || isMethod(node.parent)) return;

      ctx.report({
        node,
        messageId: 'arrow',
      });
    },
  }),
};

export { noFunction };
