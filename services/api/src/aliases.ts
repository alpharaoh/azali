import Module from "node:module";

/**
 * Resolves the "@/..." tsconfig path alias at require time. tsc emits the
 * alias verbatim into dist; Bun resolved it from tsconfig.json at runtime,
 * Node does not. __dirname is dist/ when compiled and src/ when run from
 * source, so the mapping is correct in both. Must be the first import in
 * main.ts.
 */
type ResolveFilename = (request: string, ...rest: unknown[]) => string;
const moduleInternals = Module as unknown as {
  _resolveFilename: ResolveFilename;
};

const originalResolve = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (
  this: unknown,
  request: string,
  ...rest: unknown[]
) {
  const mapped = request.startsWith("@/")
    ? `${__dirname}/${request.slice(2)}`
    : request;
  return originalResolve.call(this, mapped, ...rest) as string;
};
