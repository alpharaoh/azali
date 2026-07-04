import { env } from "#/env";

export type ClientAutonomy = "supervised" | "autopilot";
export type ClientStatus = "active" | "paused";

export type ApiClient = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  organizationId: string;
  userId: string;
  name: string;
  image: string | null;
  iorNumber: string;
  bondNumber: string;
  primaryOrigin: string;
  industry: string;
  autonomy: ClientAutonomy;
  status: ClientStatus;
  portsOfEntry: string[];
};

export type ClientSortColumn =
  | "name"
  | "iorNumber"
  | "bondNumber"
  | "primaryOrigin"
  | "industry"
  | "autonomy"
  | "status"
  | "createdAt";

export interface ListClientsParams {
  search?: string;
  status?: ClientStatus[];
  autonomy?: ClientAutonomy[];
  sortBy?: ClientSortColumn;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

const BASE_URL = `${env.API_SERVER_URL}/v1`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function listClients(params: ListClientsParams = {}) {
  const query = new URLSearchParams();

  if (params.search) query.set("search", params.search);
  if (params.status?.length) query.set("status", params.status.join(","));
  if (params.autonomy?.length)
    query.set("autonomy", params.autonomy.join(","));
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));

  const qs = query.toString();

  return request<{ data: ApiClient[]; count: number }>(
    `/clients${qs ? `?${qs}` : ""}`,
  );
}

export async function deleteClient(id: string) {
  return request<ApiClient>(`/clients/${id}`, { method: "DELETE" });
}
