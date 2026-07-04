import { useEffect, useState } from "react";
import { env } from "#/env";

export type Me = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
  } | null;
  member: {
    id: string;
    role: string;
    createdAt: string;
  } | null;
};

let cache: Me | null = null;

export function clearMeCache() {
  cache = null;
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(cache);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;

    fetch(`${env.API_SERVER_URL}/v1/users/me`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<Me>) : null))
      .then((data) => {
        if (!cancelled && data) {
          cache = data;
          setMe(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return me;
}
