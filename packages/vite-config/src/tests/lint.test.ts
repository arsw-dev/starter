import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

type Diagnostic = {
  code: string;
  filename: string;
};

const main = fileURLToPath(new URL('../main.ts', import.meta.url));
const vp = fileURLToPath(
  new URL('../../node_modules/.bin/vp', import.meta.url),
);

// Linted in a directory of their own: a file meant to fail can't live in the
// repo, where `vp check` lints it too
const files = {
  'package.json': '{ "type": "module" }',
  'vite.config.ts': `import { lint } from '${main}';\n\nexport default { lint };\n`,
  'src/styles.ts': [
    "import '#/styles/index.css';",
    "import './button.css';",
    "import 'some-package/styles.css';",
  ].join('\n'),
  'src/polyfill.ts': "import './globals.ts';\n",
  '.storybook/preview.ts': 'export default {};\n',
  '.storybook/preview.tsx': 'export default {};\n',
  '.storybook/manager.ts': 'export default {};\n',
  'src/other.ts': 'export default {};\n',
};

let dir = '';
let diagnostics: Diagnostic[] = [];

const codesIn = (filename: string) =>
  diagnostics
    .filter((diagnostic) => diagnostic.filename === filename)
    .map((diagnostic) => diagnostic.code);

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'vite-config-'));

  await Promise.all(
    Object.entries(files).map(async ([name, source]) => {
      await mkdir(path.dirname(path.join(dir, name)), {
        recursive: true,
      });

      await writeFile(path.join(dir, name), source);
    }),
  );

  const { stdout } = spawnSync(vp, ['lint', '--format', 'json'], {
    cwd: dir,
    encoding: 'utf8',
  });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint's JSON report, which has no types to import
  const report = JSON.parse(stdout) as {
    diagnostics: Diagnostic[];
  };

  ({ diagnostics } = report);
});

afterAll(async () => {
  await rm(dir, {
    recursive: true,
    force: true,
  });
});

describe('import/no-unassigned-import', () => {
  it('allows a stylesheet', () => {
    expect(codesIn('src/styles.ts')).not.toContain(
      'import(no-unassigned-import)',
    );
  });

  it('refuses a module imported for its side effects', () => {
    expect(codesIn('src/polyfill.ts')).toContain(
      'import(no-unassigned-import)',
    );
  });
});

describe('import/no-default-export', () => {
  it("allows Storybook's preview", () => {
    expect(codesIn('.storybook/preview.ts')).not.toContain(
      'import(no-default-export)',
    );

    expect(codesIn('.storybook/preview.tsx')).not.toContain(
      'import(no-default-export)',
    );
  });

  it('refuses one anywhere else, in .storybook/ too', () => {
    expect(codesIn('.storybook/manager.ts')).toContain(
      'import(no-default-export)',
    );

    expect(codesIn('src/other.ts')).toContain('import(no-default-export)');
  });
});
