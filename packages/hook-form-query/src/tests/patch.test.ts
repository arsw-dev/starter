import { describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';

import { zEnum, zNumber, zString } from '#/fields.ts';
import { buildPatch, isEqual } from '#/patch.ts';

const schema = z.object({
  title: zString({
    type: 'required',
  }),
  priority: zEnum({
    type: 'required',
    values: ['low', 'high'],
  }),
  estimate: zNumber({
    type: 'nullable',
  }),
  note: zString({
    type: 'optional',
  }),
});

// What the server holds, with a field the form doesn't edit
const server = {
  id: 1,
  title: 'Buy milk',
  priority: 'low',
  estimate: 3,
  note: 'Oat',
};

describe('buildPatch', () => {
  it('has nothing for a form that matches once parsed', () => {
    expect(
      buildPatch(schema, server, {
        title: ' Buy milk ',
        priority: 'low',
        estimate: '3',
        note: 'Oat',
      }),
    ).toStrictEqual({});
  });

  it('has only what changed, with a cleared field as null', () => {
    expect(
      buildPatch(schema, server, {
        ...server,
        title: 'Buy oat milk',
        estimate: '',
      }),
    ).toStrictEqual({
      title: 'Buy oat milk',
      estimate: null,
    });
  });

  it('leaves out a field the form holds as undefined', () => {
    expect(
      buildPatch(schema, server, {
        ...server,
        note: '',
      }),
    ).toStrictEqual({});
  });

  it('has a field the server holds but the schema rejects', () => {
    expect(
      buildPatch(
        schema,
        {
          ...server,
          priority: 'urgent',
        },
        {
          ...server,
          priority: 'high',
        },
      ),
    ).toStrictEqual({
      priority: 'high',
    });
  });

  it('has bad server data the form still holds, so the form is dirty', () => {
    const bad = {
      ...server,
      priority: 'urgent',
    };

    expect(buildPatch(schema, bad, bad)).toStrictEqual({
      priority: 'urgent',
    });
  });

  it('has a field the form holds but the schema rejects, as it is', () => {
    expect(
      buildPatch(schema, server, {
        ...server,
        estimate: 'two',
      }),
    ).toStrictEqual({
      estimate: 'two',
    });
  });
});

describe('isEqual', () => {
  it('compares dates by time', () => {
    expect(isEqual(new Date('2026-10-21'), new Date('2026-10-21'))).toBe(true);
    expect(isEqual(new Date('2026-10-21'), new Date('2026-10-22'))).toBe(false);
  });

  it('compares arrays and objects by their contents, at any depth', () => {
    expect(
      isEqual(
        {
          tags: ['a', 'b'],
          meta: {
            x: 1,
          },
        },
        {
          tags: ['a', 'b'],
          meta: {
            x: 1,
          },
        },
      ),
    ).toBe(true);
    expect(isEqual(['a'], ['a', 'b'])).toBe(false);
    expect(
      isEqual(
        {
          a: 1,
        },
        {
          a: 1,
          b: 2,
        },
      ),
    ).toBe(false);
    expect(
      isEqual(
        {
          a: undefined,
        },
        {
          b: undefined,
        },
      ),
    ).toBe(false);
    expect(isEqual([], {})).toBe(false);
  });
});
