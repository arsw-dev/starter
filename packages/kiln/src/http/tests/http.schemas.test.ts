import { expect, it } from 'vite-plus/test';

import { errorSchema, json, toResponses } from '#/http/http.schemas.ts';

it('makes each name an error body under its status, with what it means', () => {
  expect(
    toResponses({
      notFound: 'Cannot find item',
      conflict: 'Item already exists',
    }),
  ).toEqual({
    404: json(errorSchema, 'Cannot find item'),
    409: json(errorSchema, 'Item already exists'),
  });
});

it('leaves out a name that is no error', () => {
  expect(
    toResponses({
      notAnError: 'Something',
    }),
  ).toEqual({});
});
