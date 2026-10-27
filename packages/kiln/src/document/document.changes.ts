// What differs between a written document and the app's, one line per
// difference, by where it is: + only in the app's, - only in the file, ~ in
// both but different. A JSON value has no cycles, so the walk ends
type Json = unknown;

const isRecord = (value: Json): value is Record<string, Json> =>
  typeof value === 'object' && value !== null;

const at = (path: string, key: string) => (path ? `${path}.${key}` : key);

// A value as a line shows it, long ones cut short
const shown = (value: Json) => {
  const text = JSON.stringify(value);

  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
};

const toChanges = (written: Json, current: Json, path = ''): string[] => {
  if (
    isRecord(written) &&
    isRecord(current) &&
    Array.isArray(written) === Array.isArray(current)
  ) {
    const keys = [
      ...new Set([...Object.keys(written), ...Object.keys(current)]),
    ];

    return keys.flatMap((key) => {
      if (!Object.hasOwn(current, key)) return [`- ${at(path, key)}`];
      if (!Object.hasOwn(written, key)) return [`+ ${at(path, key)}`];

      return toChanges(written[key], current[key], at(path, key));
    });
  }

  if (JSON.stringify(written) === JSON.stringify(current)) return [];

  return [
    `~ ${path || '(the document)'}: ${shown(written)} -> ${shown(current)}`,
  ];
};

export { toChanges };
