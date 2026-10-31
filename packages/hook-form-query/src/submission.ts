import { buildPatch } from './patch.ts';

import type { FieldsSchema } from './patch.ts';

type Submit<TOutput> = {
  // What the schema parsed the form to
  data: TOutput;
  toVariables: ((sent: unknown) => unknown) | undefined;
} & (
  | {
      update: false;
    }
  | {
      update: true;
      schema: FieldsSchema<unknown>;
      // The form's values as they are
      current: Record<string, unknown>;
      // The server's values, undefined while they load
      server: Record<string, unknown> | undefined;
    }
);

type Submission =
  | {
      status: 'send';
      variables: unknown;
    }
  | {
      status: 'unchanged' | 'loading';
    };

// What a submit sends: for a create, what the schema parsed the form to; for an
// update, only the fields that changed from the server's values, nothing when
// none did, and nothing before the server's values arrive. Through toVariables
// when there is one
const toSubmission = <TOutput>(submit: Submit<TOutput>): Submission => {
  const { toVariables } = submit;
  const send = (sent: unknown) => ({
    status: 'send' as const,
    variables: toVariables ? toVariables(sent) : sent,
  });

  if (!submit.update) {
    return send(submit.data);
  }

  if (submit.server === undefined) {
    return {
      status: 'loading',
    };
  }

  const patch = buildPatch(submit.schema, submit.server, submit.current);

  if (Object.keys(patch).length === 0) {
    return {
      status: 'unchanged',
    };
  }

  return send(patch);
};

export { toSubmission };
export type { Submission };
