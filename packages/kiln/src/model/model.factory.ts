import { z } from '@hono/zod-openapi';
import { getTableColumns, sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { TIMESTAMP_FORMAT, isTimestamp, isUuid } from './model.constraints.ts';
import { field } from './model.fields.ts';

import type { Constraint } from './model.constraints.ts';
import type { Access, FieldOptions } from './model.fields.ts';
import type { BuildColumns, HasDefault, NotNull } from 'drizzle-orm';
import type {
  SQLiteColumnBuilderBase,
  SQLiteTableWithColumns,
} from 'drizzle-orm/sqlite-core';

// Only what defineModel calls on a column: Drizzle's own builder types differ
// per kind
type Builder = {
  notNull(): Builder;
  default(value: unknown): Builder;
};

// What every field is, whatever its kind and options
type AnyField = {
  column: (name: string) => Builder & SQLiteColumnBuilderBase;
  schema: (label: string) => z.ZodType;
  constraints: Pick<Constraint<z.ZodType>, 'name' | 'check'>[];
  options: FieldOptions<unknown>;
};

// Every model has these, so no field may take their names
type Reserved = 'pk' | 'id' | 'createdAt' | 'updatedAt';

type Fields = Record<string, AnyField> & {
  [K in Reserved]?: never;
};

// What a column becomes once `optional` and `default` are applied, as Drizzle
// types it
type Nullable<TBuilder extends SQLiteColumnBuilderBase, O> = O extends {
  optional: true;
}
  ? TBuilder
  : NotNull<TBuilder>;

type Column<TBuilder extends SQLiteColumnBuilderBase, O> = O extends {
  default: unknown;
}
  ? HasDefault<Nullable<TBuilder, O>>
  : Nullable<TBuilder, O>;

type Builders<F extends Fields> = {
  [K in keyof F]: Column<ReturnType<F[K]['column']>, F[K]['options']>;
};

type IsOptional<O> = O extends {
  optional: true;
}
  ? true
  : false;

type Schema<F extends Fields, K extends keyof F> = ReturnType<F[K]['schema']>;

// Keys whose field allows an access
type KeysWith<F extends Fields, A extends Access> = {
  [K in keyof F]: F[K]['options']['access'] extends 'all'
    ? K
    : A extends F[K]['options']['access'][number]
      ? K
      : never;
}[keyof F];

type ReadShape<F extends Fields> = {
  [K in KeysWith<F, 'read'>]: IsOptional<F[K]['options']> extends true
    ? z.ZodNullable<Schema<F, K>>
    : Schema<F, K>;
};

// A NULL or a default leaves a field out of a create
type CreateShape<F extends Fields> = {
  [K in KeysWith<F, 'create'>]: IsOptional<F[K]['options']> extends true
    ? z.ZodOptional<z.ZodNullable<Schema<F, K>>>
    : F[K]['options'] extends {
          default: unknown;
        }
      ? z.ZodOptional<Schema<F, K>>
      : Schema<F, K>;
};

type UpdateShape<F extends Fields> = {
  [K in KeysWith<F, 'update'>]: IsOptional<F[K]['options']> extends true
    ? z.ZodOptional<z.ZodNullable<Schema<F, K>>>
    : z.ZodOptional<Schema<F, K>>;
};

type Casing = 'snake_case' | 'camelCase';

type ModelOptions = {
  casing?: Casing;
};

const has = (options: FieldOptions<unknown>, access: Access) =>
  options.access === 'all' || options.access.includes(access);

// The one place the factory asserts a type: TypeScript can't type an object
// built from entries as a mapped type, so the type tests check each shape
/* oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-parameters -- an object built from entries, checked by the type tests */
const mapFields = <TShape>(
  fields: Fields,
  map: (field: AnyField, key: string) => unknown,
  access?: Access,
) =>
  Object.fromEntries(
    Object.entries(fields)
      .filter(([, f]) => access === undefined || has(f.options, access))
      .map(([key, f]) => [key, map(f, key)]),
  ) as TShape;
/* oxlint-enable typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-parameters */

// 'dueDate' is 'Due date' in a message
const toLabel = (key: string) => {
  const words = key.replaceAll(
    /[A-Z]/g,
    (letter) => ` ${letter.toLowerCase()}`,
  );

  return words.charAt(0).toUpperCase() + words.slice(1);
};

const toColumnName = (casing: Casing, key: string) =>
  casing === 'camelCase'
    ? key
    : key.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const withOptions = (builder: Builder, options: FieldOptions<unknown>) => {
  const nullable = options.optional ? builder : builder.notNull();

  return options.default === undefined
    ? nullable
    : nullable.default(options.default);
};

// A default the field's own schema would refuse or change would be a CHECK
// failure on every insert that relies on it, so it fails at definition
const assertDefault = (key: string, f: AnyField) => {
  if (f.options.default === undefined) return;

  const result = f.schema(toLabel(key)).safeParse(f.options.default);

  if (!result.success || result.data !== f.options.default) {
    throw new Error(`${key}'s default breaks its own constraints`);
  }
};

const now = () => sql`(strftime(${sql.raw(`'${TIMESTAMP_FORMAT}'`)}, 'now'))`;

const idSchema = isUuid.rule(z.uuidv4('Id must be a uuid'), 'Id');

const timestampSchema = z.iso.datetime({
  precision: 3,
});

const schemaOf = (f: AnyField, key: string) => f.schema(toLabel(key));

// An optional field's checks let NULL through: NOT NULL is what refuses it
const toCheck = (
  name: string,
  constraint: AnyField['constraints'][number],
  optional = false,
) => {
  const column = sql.identifier(name);
  const rule = constraint.check(column);

  return check(
    `${name}_${constraint.name}`,
    optional ? sql`${column} IS NULL OR (${rule})` : rule,
  );
};

// The columns every model has, around its own fields
const baseColumns = (name: (key: string) => string) => ({
  pk: integer('pk').primaryKey(),
  id: text('id')
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: text(name('createdAt')).notNull().default(now()),
  updatedAt: text(name('updatedAt')).notNull().default(now()).$onUpdate(now),
});

type BaseColumns = ReturnType<typeof baseColumns>;

// A model's table, as Drizzle types it. Named, because Drizzle's table and
// column types refer to each other, which a declaration can't spell out
type Table<TName extends string, F extends Fields> = SQLiteTableWithColumns<{
  name: TName;
  schema: undefined;
  columns: BuildColumns<
    TName,
    Omit<BaseColumns, 'createdAt' | 'updatedAt'> &
      Builders<F> &
      Pick<BaseColumns, 'createdAt' | 'updatedAt'>,
    'sqlite'
  >;
  dialect: 'sqlite';
}>;

// Every column, as Drizzle has them, and the ones a read returns
type Columns<TName extends string, F extends Fields> = Table<
  TName,
  F
>['_']['columns'];

type ReadColumns<TName extends string, F extends Fields> = Pick<
  Columns<TName, F>,
  'id' | 'createdAt' | 'updatedAt'
> & {
  [K in KeysWith<F, 'read'>]: Columns<TName, F>[K & keyof Columns<TName, F>];
};

const createDefineModel = ({ casing = 'snake_case' }: ModelOptions = {}) => {
  const name = (key: string) => toColumnName(casing, key);

  // The fields come from a function given the field kinds, so a model needs
  // nothing imported but defineModel
  const defineModel = <TName extends string, F extends Fields>(
    tableName: TName,
    define: (kinds: typeof field) => F,
  ) => {
    const fields = define(field);

    for (const [key, f] of Object.entries(fields)) assertDefault(key, f);

    const builders = mapFields<Builders<F>>(fields, (f, key) =>
      withOptions(f.column(name(key)), f.options),
    );

    const { pk, id, createdAt, updatedAt } = baseColumns(name);

    const table: Table<TName, F> = sqliteTable(
      tableName,
      {
        pk,
        id,
        ...builders,
        createdAt,
        updatedAt,
      },
      () => [
        toCheck('id', isUuid),
        ...Object.entries(fields).flatMap(([key, f]) =>
          f.constraints.map((c) => toCheck(name(key), c, f.options.optional)),
        ),
        toCheck(name('createdAt'), isTimestamp),
        toCheck(name('updatedAt'), isTimestamp),
      ],
    );

    // Every column, as Drizzle has them, and only the ones readSchema describes:
    // selecting with readColumns keeps pk and unread fields in the database
    const columns: Columns<TName, F> = getTableColumns(table);
    const byKey: Record<string, unknown> = columns;

    const readColumns: ReadColumns<TName, F> = {
      id: columns.id,
      ...mapFields<{
        [K in KeysWith<F, 'read'>]: (typeof columns)[K & keyof typeof columns];
      }>(fields, (_, key) => byKey[key], 'read'),
      createdAt: columns.createdAt,
      updatedAt: columns.updatedAt,
    };

    const readSchema = z.object({
      id: idSchema,
      ...mapFields<ReadShape<F>>(
        fields,
        (f, key) =>
          f.options.optional ? schemaOf(f, key).nullable() : schemaOf(f, key),
        'read',
      ),
      createdAt: timestampSchema,
      updatedAt: timestampSchema,
    });

    const createSchema = z
      .object(
        mapFields<CreateShape<F>>(
          fields,
          (f, key) => {
            if (f.options.optional)
              return schemaOf(f, key).nullable().optional();

            return f.options.default === undefined
              ? schemaOf(f, key)
              : schemaOf(f, key).optional();
          },
          'create',
        ),
      )
      .strict();

    const updateSchema = z
      .object(
        mapFields<UpdateShape<F>>(
          fields,
          (f, key) =>
            f.options.optional
              ? schemaOf(f, key).nullable().optional()
              : schemaOf(f, key).optional(),
          'update',
        ),
      )
      .strict()
      .refine(
        (values) => Object.keys(values).length > 0,
        'Send at least one field to update',
      )
      // A refine has no JSON Schema form, so the document says it this way
      .openapi({
        minProperties: 1,
      });

    const paramsSchema = z.object({
      id: idSchema,
    });

    return {
      table,
      columns,
      readColumns,
      readSchema,
      createSchema,
      updateSchema,
      paramsSchema,
    };
  };

  return defineModel;
};

export { createDefineModel, idSchema, timestampSchema };
