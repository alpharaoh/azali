import { useMemo } from "react";
import type { ListClientsResponseDtoDataItem } from "#/generated/api";
import { useClientsControllerFindAll } from "#/generated/api";
import { clientLogos } from "#/data/client-logos";

export interface ClientRef {
  id: string;
  name: string;
  logo?: string;
}

/** Org clients keyed by id, for joining shipment rows client-side. */
export function useClientsById() {
  const { data } = useClientsControllerFindAll({ limit: 100 });

  return useMemo(() => {
    const map = new Map<string, ClientRef>();

    for (const client of (data?.data.data ??
      []) as ListClientsResponseDtoDataItem[]) {
      map.set(client.id, {
        id: client.id,
        name: client.name,
        logo: client.image ?? clientLogos[client.name],
      });
    }

    return map;
  }, [data]);
}
