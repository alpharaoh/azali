const BASE_URL = "https://hts.usitc.gov/reststop";

export async function htsRequest<T>(
  path: string,
  params?: Record<string, string | number | boolean>,
): Promise<T> {
  const query = params
    ? `?${new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).map(([key, value]) => [key, String(value)]),
        ),
      )}`
    : "";

  const response = await fetch(`${BASE_URL}${path}${query}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`HTS request failed (${response.status}): ${path}`);
  }

  return (await response.json()) as T;
}

/** Fetch a published HTS file (chapter PDFs) from the current release. */
export async function htsFile(filename: string): Promise<Uint8Array> {
  const query = new URLSearchParams({ release: "currentRelease", filename });
  const response = await fetch(`${BASE_URL}/file?${query}`, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `HTS file request failed (${response.status}): ${filename}`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}
