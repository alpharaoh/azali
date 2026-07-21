import { customType } from "drizzle-orm/pg-core";

// Drizzle's built-in jsonb has driver-specific serialization quirks, and
// node-postgres has its own: a raw JS array param is encoded as a Postgres
// *array literal* (`{...}`), not JSON. Stringify in toDriver so the driver
// receives ready-made jsonb text either way.
export const jsonbObject = customType<{ data: Record<string, unknown> }>({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    return JSON.stringify(value);
  },
  fromDriver(value) {
    return (typeof value === "string" ? JSON.parse(value) : value) as Record<
      string,
      unknown
    >;
  },
});

/** Same driver handling as jsonbObject, for columns holding a JSON array. */
export const jsonbArray = customType<{ data: Array<Record<string, unknown>> }>({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    return JSON.stringify(value);
  },
  fromDriver(value) {
    return (typeof value === "string" ? JSON.parse(value) : value) as Array<
      Record<string, unknown>
    >;
  },
});
