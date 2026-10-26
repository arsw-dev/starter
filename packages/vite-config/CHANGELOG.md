# Changelog

## 0.1.3

A Storybook setup lints as it is:

- **A stylesheet may be imported for its side effects:**
  `import/no-unassigned-import` allows `**/*.css`, as Vite loads a stylesheet
  that way. A side-effect import of a JavaScript or TypeScript module still
  fails.
- **Storybook's preview may export a default:** `import/no-default-export` is
  off in `.storybook/preview.ts` and `.storybook/preview.tsx`, which Storybook
  loads by their default export. `.storybook/main.ts` already passed as a
  `main.ts`; the rest of `.storybook/` keeps the rule.

## 0.1.2

A type augmentation can live in a declaration file of its own:

- **A `.d.ts` may declare an interface:**
  `typescript/consistent-type-definitions` is off there. A declaration file's
  interfaces are there to merge, which a `type` alias can't, and the rule's fix
  turned an augmentation into an alias that silently stopped applying.
- **`main.ts` may reference a file by path:**
  `typescript/triple-slash-reference` allows `/// <reference path="…" />` in an
  entry, so any program that includes the entry, a front end's typed client
  among them, has its declaration files too. `types` and `lib` references keep
  the rule's defaults.

## 0.1.1

No `typescript` peer: its range, `>=7.0.0-0`, turned away TypeScript 7.1's
nightlies, and npm refused to install next to one. `pack` finds `typescript` in
the project it builds instead.

## 0.1.0

The first release: `fmt` and `lint`, with the guardrails rules on, and `pack`
for libraries built for npm.
