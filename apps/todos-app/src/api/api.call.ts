import { ApiError } from './api.error.ts';
import { api } from './api.server.ts';

import type { ApiClient } from './api.server.ts';
import type { ClientResponse } from 'hono/client';

type AnyResponse = ClientResponse<unknown, number>;

// hc types a response as one member per status the route can answer; ok is
// true only on the success ones
type Success<TResponse extends AnyResponse> = Extract<
  TResponse,
  {
    ok: true;
  }
>;

// A 204 has no body to read
type BodyOf<TSuccess> = TSuccess extends {
  status: 204;
}
  ? undefined
  : TSuccess extends {
        json: () => Promise<infer TBody>;
      }
    ? TBody
    : never;

type Body<TResponse extends AnyResponse> = BodyOf<Success<TResponse>>;

// What Start hands a handler: the validated input, as data
type HandlerInput<TData> = {
  data: TData;
};

// A server function's handler from one call to todos-api: the success body,
// typed, or an ApiError
const call =
  <TData, TResponse extends AnyResponse>(
    request: (client: ApiClient, data: TData) => Promise<TResponse>,
  ) =>
  async ({ data }: HandlerInput<TData>): Promise<Body<TResponse>> => {
    const response = await request(api(), data);

    if (!response.ok) throw new ApiError(response.status);

    const body: unknown =
      response.status === 204 ? undefined : await response.json();

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the check above leaves only the success members, which TypeScript doesn't narrow a type parameter to
    return body as Body<TResponse>;
  };

export { call };
