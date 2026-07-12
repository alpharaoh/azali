const BASE_URL = "https://rulings.cbp.gov/api";

export async function crossRequest<T>(
  path: string,
  params?: Record<string, string | number>,
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
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`CROSS request failed (${response.status}): ${path}`);
  }

  return (await response.json()) as T;
}
