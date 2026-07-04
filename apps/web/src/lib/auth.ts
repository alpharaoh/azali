import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "#/env";
import { queryClient } from "#/lib/query-client";

export const authClient = createAuthClient({
  baseURL: env.API_SERVER_URL,
  plugins: [emailOTPClient(), organizationClient()],
});

// Session lookup shared between route guards, cached in react-query so
// navigating between dashboard pages doesn't refetch /get-session every time.
export const sessionQueryOptions = {
  queryKey: ["session"] as const,
  queryFn: async () => {
    const { data } = await authClient.getSession();
    return data;
  },
  staleTime: 5 * 60 * 1000,
};

// Call after a sign-in completes client-side (e.g. email OTP) so the cached
// null session from the login page doesn't bounce the user back to /login.
export function clearAuthCache() {
  queryClient.clear();
}

const SIGNING_OUT_KEY = "signing-out";

export function isSigningOut() {
  return sessionStorage.getItem(SIGNING_OUT_KEY) === "1";
}

// Navigates away immediately and lets the sign-out request finish in the
// background. The flag stops the login route from bouncing back to the
// dashboard while the session is still being revoked server-side.
export function signOutAndRedirect(onNavigate: () => void) {
  sessionStorage.setItem(SIGNING_OUT_KEY, "1");
  queryClient.clear();
  authClient.signOut().finally(() => {
    sessionStorage.removeItem(SIGNING_OUT_KEY);
  });
  onNavigate();
}
