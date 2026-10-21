import { mutationOptions, queryOptions } from '@tanstack/react-query';

import type {
  DataTag,
  QueryKey,
  UnusedSkipTokenOptions,
  UseMutationOptions,
} from '@tanstack/react-query';

// A server function, as Start types one: called with a single options object
type AnyServerFn = (options: never) => Promise<unknown>;

// What its validator takes, or undefined when it has none
type InputOf<TFn extends AnyServerFn> =
  NonNullable<Parameters<TFn>[0]> extends {
    data?: infer TInput;
  }
    ? TInput
    : undefined;

type OutputOf<TFn extends AnyServerFn> = Awaited<ReturnType<TFn>>;

type HasInput<TFn extends AnyServerFn> = [InputOf<TFn>] extends [undefined]
  ? false
  : true;

type QueryDefaults<TData> = Omit<
  UnusedSkipTokenOptions<TData>,
  'queryKey' | 'queryFn' | 'select'
>;

// What a definition hands useQuery, useSuspenseQuery or prefetchQuery: the
// key carries the data's type, so getQueryData and setQueryData know it too
type QueryOptions<TData> = UnusedSkipTokenOptions<TData> & {
  queryKey: DataTag<QueryKey, TData, Error>;
};

type QueryDefinition<TFn extends AnyServerFn> = (HasInput<TFn> extends true
  ? (params: InputOf<TFn>) => QueryOptions<OutputOf<TFn>>
  : () => QueryOptions<OutputOf<TFn>>) & {
  // Every key this query makes starts with it, whatever its params
  baseKey: QueryKey;
  getQueryKey: HasInput<TFn> extends true
    ? (params: InputOf<TFn>) => QueryKey
    : () => QueryKey;
};

// A mutation's one variable is the server function's input
type VariablesOf<TFn extends AnyServerFn> =
  HasInput<TFn> extends true ? InputOf<TFn> : void;

type MutationOverrides<TData, TVariables, TOnMutateResult = unknown> = Omit<
  UseMutationOptions<TData, Error, TVariables, TOnMutateResult>,
  'mutationKey' | 'mutationFn'
>;

type MutationDefaults<TData, TVariables> = MutationOverrides<
  TData,
  TVariables
> & {
  // What a success makes stale, wherever the mutation is used. Read when it
  // succeeds, so it can name this API's own queries; its return is then
  // annotated (): QueryKey[], or TypeScript can't type the API through its own
  // initializer
  invalidates?: (data: TData, variables: TVariables) => QueryKey[];
};

type MutationDefinition<TFn extends AnyServerFn> = (<TOnMutateResult = unknown>(
  options?: MutationOverrides<OutputOf<TFn>, VariablesOf<TFn>, TOnMutateResult>,
) => UseMutationOptions<
  OutputOf<TFn>,
  Error,
  VariablesOf<TFn>,
  TOnMutateResult
>) & {
  mutationKey: QueryKey;
};

const KIND = Symbol('kind');

type QueryDescriptor<TFn extends AnyServerFn> = {
  [KIND]: 'query';
  fn: TFn;
  defaults: QueryDefaults<OutputOf<TFn>>;
};

type MutationDescriptor<TFn extends AnyServerFn> = {
  [KIND]: 'mutation';
  fn: TFn;
  defaults: MutationDefaults<OutputOf<TFn>, VariablesOf<TFn>>;
};

// baseKey is the namespace's own key, at every level, so no definition takes
// the name
type Tree = {
  baseKey?: never;
  [name: string]:
    | QueryDescriptor<AnyServerFn>
    | MutationDescriptor<AnyServerFn>
    | Tree;
};

type Bound<TTree> = {
  [K in keyof TTree]: TTree[K] extends QueryDescriptor<infer TFn>
    ? QueryDefinition<TFn>
    : TTree[K] extends MutationDescriptor<infer TFn>
      ? MutationDefinition<TFn>
      : Bound<TTree[K]>;
} & {
  baseKey: QueryKey;
};

const builders = {
  query: <TFn extends AnyServerFn>(
    fn: TFn,
    defaults: QueryDefaults<OutputOf<TFn>> = {},
  ): QueryDescriptor<TFn> => ({
    [KIND]: 'query',
    fn,
    defaults,
  }),
  mutation: <TFn extends AnyServerFn>(
    fn: TFn,
    defaults: MutationDefaults<OutputOf<TFn>, VariablesOf<TFn>> = {},
  ): MutationDescriptor<TFn> => ({
    [KIND]: 'mutation',
    fn,
    defaults,
  }),
};

// Below, the walk works on what a definition is at runtime: the types above
// say what each one is to its caller, and the cast at the end joins the two
/* oxlint-disable typescript/no-unsafe-type-assertion -- the one place a definition's static type and its runtime shape meet */

type RuntimeServerFn = (options: {
  data: unknown;
  signal?: AbortSignal;
}) => Promise<unknown>;

type RuntimeDescriptor = {
  [KIND]: 'query' | 'mutation';
  fn: RuntimeServerFn;
  defaults: QueryDefaults<unknown> &
    MutationDefaults<unknown, unknown> &
    MutationOverrides<unknown, unknown>;
};

const isDescriptor = (value: unknown): value is RuntimeDescriptor =>
  typeof value === 'object' && value !== null && KIND in value;

// The params, when there are any: a query with none has no slot for them, so
// its key is its base key, and invalidating the base key reaches it
const keyFor = (baseKey: QueryKey, params: unknown): QueryKey =>
  params === undefined ? baseKey : [...baseKey, params];

const bindQuery = ({ fn, defaults }: RuntimeDescriptor, baseKey: QueryKey) => {
  const getQueryKey = (params?: unknown) => keyFor(baseKey, params);

  const definition = (params?: unknown) =>
    queryOptions({
      ...defaults,
      queryKey: getQueryKey(params),
      queryFn: async ({ signal }) =>
        fn({
          data: params,
          signal,
        }),
    });

  return Object.assign(definition, {
    baseKey,
    getQueryKey,
  });
};

// The call site's options win over the definition's, except that a success
// first invalidates what the definition names, so a page's own onSuccess sees
// fresh data and the mutation stays pending until it's refetched
const bindMutation = (
  { fn, defaults }: RuntimeDescriptor,
  mutationKey: QueryKey,
) => {
  const { invalidates, ...options } = defaults;

  const definition = (overrides: MutationOverrides<unknown, unknown> = {}) => {
    const merged = {
      ...options,
      ...overrides,
    };

    return mutationOptions({
      ...merged,
      mutationKey,
      mutationFn: async (variables: unknown) =>
        fn({
          data: variables,
        }),
      onSuccess: async (data, variables, onMutateResult, context) => {
        const stale = invalidates?.(data, variables) ?? [];

        await Promise.all(
          stale.map(async (queryKey) =>
            context.client.invalidateQueries({
              queryKey,
            }),
          ),
        );

        return merged.onSuccess?.(data, variables, onMutateResult, context);
      },
    });
  };

  return Object.assign(definition, {
    mutationKey,
  });
};

const bind = (tree: Record<string, unknown>, path: string[]): unknown =>
  Object.fromEntries([
    ['baseKey', path],
    ...Object.entries(tree).map(([name, value]) => {
      const key = [...path, name];

      if (!isDescriptor(value)) {
        return [name, bind(value as Record<string, unknown>, key)];
      }

      return [
        name,
        value[KIND] === 'query'
          ? bindQuery(value, key)
          : bindMutation(value, key),
      ];
    }),
  ]);

// An API's queries and mutations, keyed by where they sit: the namespace, then
// each property down to the definition, then its params
const defineApi = <TTree extends Tree>(
  namespace: string,
  build: (api: typeof builders) => TTree,
): Bound<TTree> => bind(build(builders), [namespace]) as Bound<TTree>;

/* oxlint-enable typescript/no-unsafe-type-assertion */

export { defineApi };
