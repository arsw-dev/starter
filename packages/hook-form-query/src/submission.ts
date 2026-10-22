import { buildPatch } from './patch.ts';

import type { FieldsSchema } from './patch.ts';

type Submit<TOutput> = {
  schema: FieldsSchema<TOutput>;
  // What the schema parsed the form to, and the form's values as they are
  data: TOutput;
  current: Record<string, unknown>;
  // An update's: the server's values, undefined while they load
  update: boolean;
  server: Record<string, unknown> | undefined;
  toVariables: ((sent: unknown) => unknown) | undefined;
};

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
const toSubmission = <TOutput>({
  schema,
  data,
  current,
  update,
  server,
  toVariables,
}: Submit<TOutput>): Submission => {
  const send = (sent: unknown) => ({
    status: 'send' as const,
    variables: toVariables ? toVariables(sent) : sent,
  });

  if (!update) {
    return send(data);
  }

  if (server === undefined) {
    return {
      status: 'loading',
    };
  }

  const patch = buildPatch(schema, server, current);

  if (Object.keys(patch).length === 0) {
    return {
      status: 'unchanged',
    };
  }

  return send(patch);
};

export { toSubmission };
export type { Submission };
