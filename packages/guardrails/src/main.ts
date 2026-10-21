import { bracedElse } from './rules/braced-else/braced-else.ts';
import { breathe } from './rules/breathe/breathe.ts';
import { disableReason } from './rules/disable-reason/disable-reason.ts';
import { importPath } from './rules/import-path/import-path.ts';
import { namedColumns } from './rules/named-columns/named-columns.ts';
import { noFunction } from './rules/no-function/no-function.ts';
import { noInlineExport } from './rules/no-inline-export/no-inline-export.ts';
import { objectWrap } from './rules/object-wrap/object-wrap.ts';
import { sortedExports } from './rules/sorted-exports/sorted-exports.ts';

const plugin = {
  meta: {
    name: 'arsw',
  },
  rules: {
    'braced-else': bracedElse,
    breathe,
    'disable-reason': disableReason,
    'import-path': importPath,
    'named-columns': namedColumns,
    'no-function': noFunction,
    'no-inline-export': noInlineExport,
    'object-wrap': objectWrap,
    'sorted-exports': sortedExports,
  },
};

export default plugin;
