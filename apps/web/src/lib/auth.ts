import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "#/env";
import { clearMeCache } from "#/lib/use-me";

export const authClient = createAuthClient({
  baseURL: env.API_SERVER_URL,
  plugins: [emailOTPClient(), organizationClient()],
});

const SIGNING_OUT_KEY = "signing-out";

export function isSigningOut() {
  return sessionStorage.getItem(SIGNING_OUT_KEY) === "1";
}

// Navigates away immediately and lets the sign-out request finish in the
// background. The flag stops the login route from bouncing back to the
// dashboard while the session is still being revoked server-side.
export function signOutAndRedirect(onNavigate: () => void) {
  sessionStorage.setItem(SIGNING_OUT_KEY, "1");
  clearMeCache();
  authClient.signOut().finally(() => {
    sessionStorage.removeItem(SIGNING_OUT_KEY);
  });
  onNavigate();
}
