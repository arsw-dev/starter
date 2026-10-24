import { createServerOnlyFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { hc } from 'hono/client';

import { toApiError, unwrap } from './unwrap.ts';

import type { Hono } from 'hono';
import type { ClientResponse } from 'hono/client';

// A service binding, as a Worker's env holds one: a fetch that reaches another
// Worker
type ServiceBinding = {
  fetch: (request: Request) => Promise<Response>;
};

// oxlint-disable-next-line typescript/no-explicit-any -- hc's own constraint: any app, whatever its env and routes
type AnyApp = Hono<any, any, any>;

// The typed client for an app's routes, for what a request takes:
// InferRequestType<…> on a route
type Client<TApp extends AnyApp> = ReturnType<typeof hc<TApp>>;

type AnyResponse = ClientResponse<unknown, number>;

// hc types a response as one member per status the route can answer; ok is
// true only on the success ones
type Success<TResponse extends AnyResponse> = Extract<
  TResponse,
  {
    ok: true;
  }
>;

// A 204 has none
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

type Options = {
  // The API's name, in its errors and logs: any text
  name: string;
  // Headers of the request the server function is handling, by name, sent on
  // every call. Only the ones named: the rest, cookies among them, stay with
  // the app
  forward?: string[];
};

// A call's own header wins over a forwarded one of the same name: it's the
// more specific of the two. A named header the incoming request doesn't have
// isn't sent, so the API sees none rather than an empty one. With nothing to
// forward, the incoming request isn't read at all
const withForwarded = (forward: string[], init?: RequestInit) => {
  if (forward.length === 0) {
    return init;
  }

  const incoming = getRequestHeaders();
  const headers = new Headers(init?.headers);

  for (const name of forward) {
    const value = incoming.get(name);

    if (value !== null && !headers.has(name)) {
      headers.set(name, value);
    }
  }

  return {
    ...init,
    headers,
  };
};

// A front end's way to reach one API over its service binding. What it returns,
// call, builds a server function's handler from one request: the success body,
// typed, or an ApiError
const connect = <TApp extends AnyApp>(
  binding: () => ServiceBinding,
  { name, forward = [] }: Options,
) => {
  // A service binding ignores the host: hc only needs a URL to build paths on.
  // .internal never resolves publicly, so a request that leaked past the
  // binding would reach nothing
  const origin = 'https://api.internal';

  const client = createServerOnlyFn(() =>
    hc<TApp>(origin, {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, withForwarded(forward, init));
        const response = await binding().fetch(request);

        // Never expected: logged here too, since a binding with no API behind
        // it answers without the API ever seeing the request
        if (response.status >= 500) {
          console.error(
            `${name} answered ${response.status}: ${request.method} ${request.url}`,
          );
        }

        return response;
      },
    }),
  );

  return <TData, TResponse extends AnyResponse>(
    request: (client: Client<TApp>, data: TData) => Promise<TResponse>,
  ) =>
    async ({ data }: HandlerInput<TData>): Promise<Body<TResponse>> => {
      try {
        const body = await unwrap(name, await request(client(), data));

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- unwrap returns only a success's body, and hc's types say what that is
        return body as Body<TResponse>;
      } catch (error) {
        throw toApiError(name, error);
      }
    };
};

export { connect };
export type { Client, ServiceBinding };
