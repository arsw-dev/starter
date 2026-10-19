import { objectWrap } from './rules/object-wrap/object-wrap.ts';

const plugin = {
  meta: {
    name: 'arsw',
  },
  rules: {
    'object-wrap': objectWrap,
  },
};

export default plugin;
