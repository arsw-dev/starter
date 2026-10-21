import { ApiError } from './api.error.ts';
import { api } from './api.server.ts';

import type { ClientResponse } from 'hono/client';

type Client = ReturnType<typeof api>;

type AnyResponse = ClientResponse<unknown, number>;

// hc types a response as one member per status the route can answer; ok is
// true only on the success ones
type Success<TResponse extends AnyResponse> = Extract<
  TResponse,
  {
    ok: true;
  }
>;

type Body<TResponse extends AnyResponse> = Awaited<
  ReturnType<Success<TResponse>['json']>
>;

// What Start hands a handler: the validated input, as data
type HandlerInput<TData> = {
  data: TData;
};

// A server function's handler from one call to todos-api: the success body,
// typed, or an ApiError
const call =
  <TData, TResponse extends AnyResponse>(
    request: (client: Client, data: TData) => Promise<TResponse>,
  ) =>
  async ({ data }: HandlerInput<TData>): Promise<Body<TResponse>> => {
    const response = await request(api(), data);

    if (!response.ok) throw new ApiError(response.status);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the check above leaves only the success members, which TypeScript doesn't narrow a type parameter to
    return response.json() as Promise<Body<TResponse>>;
  };

export { call };
