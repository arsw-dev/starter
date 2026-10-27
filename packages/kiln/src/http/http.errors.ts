import { HTTPException } from 'hono/http-exception';

import type { ErrorBody } from './http.types.ts';
import type {
  Context,
  ErrorHandler,
  NotFoundHandler,
  TypedResponse,
} from 'hono';
import type {
  ClientErrorStatusCode,
  ServerErrorStatusCode,
} from 'hono/utils/http-status';

// Every standard client and server error, by the camelCase of its reason
// phrase, in RFC 9110's words where it renamed one (contentTooLarge,
// unprocessableContent). 418 isn't one: the RFC reserves it, unused
const STATUSES = {
  badRequest: 400,
  unauthorized: 401,
  paymentRequired: 402,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  notAcceptable: 406,
  proxyAuthenticationRequired: 407,
  requestTimeout: 408,
  conflict: 409,
  gone: 410,
  lengthRequired: 411,
  preconditionFailed: 412,
  contentTooLarge: 413,
  uriTooLong: 414,
  unsupportedMediaType: 415,
  rangeNotSatisfiable: 416,
  expectationFailed: 417,
  misdirectedRequest: 421,
  unprocessableContent: 422,
  locked: 423,
  failedDependency: 424,
  tooEarly: 425,
  upgradeRequired: 426,
  preconditionRequired: 428,
  tooManyRequests: 429,
  requestHeaderFieldsTooLarge: 431,
  unavailableForLegalReasons: 451,
  internalServerError: 500,
  notImplemented: 501,
  badGateway: 502,
  serviceUnavailable: 503,
  gatewayTimeout: 504,
  httpVersionNotSupported: 505,
  variantAlsoNegotiates: 506,
  insufficientStorage: 507,
  loopDetected: 508,
  notExtended: 510,
  networkAuthenticationRequired: 511,
} as const satisfies Record<
  string,
  ClientErrorStatusCode | ServerErrorStatusCode
>;

// Looked up by a name a declaration gives, which at runtime is any string
const statusByName = new Map<string, ErrorStatus>(Object.entries(STATUSES));

type ErrorName = keyof typeof STATUSES;

type ErrorStatus = (typeof STATUSES)[ErrorName];

type StatusOf<Name extends string> = (typeof STATUSES)[Name & ErrorName];

// What Kiln answers on every route itself: the 422 the validation hook sends,
// with its issues, and the 500 onError sends
type KilnErrorName = 'unprocessableContent' | 'internalServerError';

// Errors by name, and what each means where it's declared ('Cannot find
// todo'), as Kiln reads a declaration at runtime
type ErrorDescriptions = Partial<Record<string, string>>;

// What errors.<name>() answers: the error's status, typed, so a handler's
// return type says which errors it answers. A Response at runtime, but not in
// its type: a Response beside it in a handler's return type, such as
// c.newResponse()'s, would absorb it, and with it the status
type ErrorResponse<Status extends ErrorStatus> = TypedResponse<
  ErrorBody,
  Status,
  'json'
>;

// What a handler is given: a function for each error declared, which answers
// with the message given, or the declared description
type Errors<Names extends string> = {
  readonly [Name in Names & ErrorName]: (
    message?: string,
  ) => ErrorResponse<StatusOf<Name>>;
};

// The statuses a handler answers, from its return type: one per typed
// response it can return
type StatusOfResponse<Answered> = Answered extends {
  _status: infer Status;
}
  ? Status
  : never;

// The names a handler returns, by their statuses
type ReturnedName<Return> = {
  [Name in ErrorName]: StatusOf<Name> extends StatusOfResponse<Awaited<Return>>
    ? Name
    : never;
}[ErrorName];

// What a declaration may say: a description for each name. One that isn't an
// error's name, that Kiln answers itself, or that the handler never returns is
// a type error at the name, whose message says which. Return's constraint must
// answer every name declared: TypeScript reads this before the handler, while
// Return is still its constraint, and a name that fails then fixes Return to it
type Declaration<Names extends string, Return, Kiln extends ErrorName> = {
  [Name in Names]: string;
} & {
  [Name in Exclude<Names, ErrorName>]: `${Name} is not an error's name`;
} & {
  [Name in Kiln]?: `${Name} is answered by Kiln`;
} & {
  [
    Name in Exclude<ErrorName, ReturnedName<Return> | Kiln>
  ]?: `${Name} is declared but never returned`;
};

// The errors a declaration gives a handler, for one request
const toErrors = (c: Context, descriptions: ErrorDescriptions) =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fromEntries can't carry the keys: each is a declared name, whose status the type checked
  Object.fromEntries(
    Object.entries(descriptions).flatMap(([name, description]) => {
      const status = statusByName.get(name);

      return status === undefined || description === undefined
        ? []
        : [
            [
              name,
              (message = description): ErrorResponse<ErrorStatus> =>
                c.json(
                  {
                    message,
                  } satisfies ErrorBody,
                  status,
                ),
            ],
          ];
    }),
  ) as Errors<ErrorName>;

// What a middleware answers with, given what its handler returned: an error,
// which is a Response at runtime, or nothing
const toAnswer = (answered: ErrorResponse<ErrorStatus> | void) =>
  answered instanceof Response ? answered : undefined;

const notFound: NotFoundHandler = (ctx) =>
  ctx.json(
    {
      message: 'Not Found',
    } satisfies ErrorBody,
    404,
  );

// A 500 as one object, so Workers Logs can filter on each field: the error,
// spelled out since an Error inside an object logs as {}, and where it
// happened. The path without its query, and nothing of the body or who sent
// it: a log must not carry personal data
const toErrorLog = (err: Error, ctx: Context) => ({
  error: {
    name: err.name,
    message: err.message,
    stack: err.stack,
  },
  method: ctx.req.method,
  path: ctx.req.path,
  rayId: ctx.req.header('cf-ray'),
});

// Kiln's own 400 and 415, which Hono's validator and zod-openapi throw for a
// body that isn't JSON, keep their status and message. Anything else thrown is
// a 500 that says nothing about it: an error a route answers is returned, and
// declared, never thrown
const onError: ErrorHandler = (err, ctx) => {
  if (
    err instanceof HTTPException &&
    (err.status === STATUSES.badRequest ||
      err.status === STATUSES.unsupportedMediaType)
  ) {
    return ctx.json(
      {
        message: err.message,
      } satisfies ErrorBody,
      err.status,
    );
  }

  console.error(toErrorLog(err, ctx));

  return ctx.json(
    {
      message: 'Internal Server Error',
    } satisfies ErrorBody,
    500,
  );
};

export { STATUSES, notFound, onError, statusByName, toAnswer, toErrors };
export type {
  Declaration,
  ErrorDescriptions,
  ErrorName,
  ErrorResponse,
  ErrorStatus,
  Errors,
  KilnErrorName,
  StatusOf,
};
