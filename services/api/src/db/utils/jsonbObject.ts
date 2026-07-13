import { customType } from "drizzle-orm/pg-core";

// Drizzle's built-in jsonb double-serializes with the bun-sql driver (drizzle
// stringifies, then Bun.SQL encodes that string again → stored as a jsonb
// *string*). Pass the raw object through and let Bun.SQL serialize it once.
export const jsonbObject = customType<{ data: Record<string, unknown> }>({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return (typeof value === "string" ? JSON.parse(value) : value) as Record<
      string,
      unknown
    >;
  },
});
