import { describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';

import { zNumber, zString } from '#/fields.ts';
import { toSubmission } from '#/submission.ts';

const schema = z.object({
  title: zString({
    type: 'required',
  }),
  estimate: zNumber({
    type: 'nullable',
  }),
});

const server = {
  id: 1,
  title: 'Buy milk',
  estimate: 3,
};

const submit = (overrides: Partial<Parameters<typeof toSubmission>[0]>) =>
  toSubmission({
    schema,
    data: {
      title: 'Buy oat milk',
      estimate: null,
    },
    current: {
      title: 'Buy oat milk',
      estimate: '',
    },
    update: false,
    server: undefined,
    toVariables: undefined,
    ...overrides,
  });

describe('toSubmission', () => {
  it("sends a create's parsed form whole", () => {
    expect(submit({})).toStrictEqual({
      status: 'send',
      variables: {
        title: 'Buy oat milk',
        estimate: null,
      },
    });
  });

  it("sends only an update's changes", () => {
    expect(
      submit({
        update: true,
        server,
      }),
    ).toStrictEqual({
      status: 'send',
      variables: {
        title: 'Buy oat milk',
        estimate: null,
      },
    });

    expect(
      submit({
        update: true,
        server,
        current: {
          title: 'Buy oat milk',
          estimate: '3',
        },
      }),
    ).toStrictEqual({
      status: 'send',
      variables: {
        title: 'Buy oat milk',
      },
    });
  });

  it('sends nothing for an update that changed nothing', () => {
    expect(
      submit({
        update: true,
        server,
        current: {
          title: ' Buy milk ',
          estimate: '3',
        },
      }),
    ).toStrictEqual({
      status: 'unchanged',
    });
  });

  it("sends nothing before an update's server values arrive", () => {
    expect(
      submit({
        update: true,
      }),
    ).toStrictEqual({
      status: 'loading',
    });
  });

  it('sends what toVariables makes of it', () => {
    expect(
      submit({
        update: true,
        server,
        toVariables: (patch) => ({
          id: server.id,
          patch,
        }),
      }),
    ).toStrictEqual({
      status: 'send',
      variables: {
        id: 1,
        patch: {
          title: 'Buy oat milk',
          estimate: null,
        },
      },
    });
  });
});
