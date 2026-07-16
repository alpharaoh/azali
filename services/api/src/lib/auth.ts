import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  EmailService,
  EmailServiceType,
} from "@/services/external/resend/service";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.TRUSTED_ORIGINS,
  experimental: { joins: true },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  session: {
    // Serve get-session from a short-lived signed cookie instead of a DB
    // roundtrip on every request — the DB is only consulted when the cookie
    // expires (or the session changes, which rewrites it).
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // Users created via email OTP have no name/image; copy them from the
      // Google profile when the account gets linked.
      updateUserInfoOnLink: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const now = new Date();
          const orgId = crypto.randomUUID();
          const baseSlug =
            user.email
              .split("@")[0]
              ?.toLowerCase()
              .replace(/[^a-z0-9]+/g, "-") ?? "workspace";
          const firstName =
            user.name.trim().split(/\s+/)[0] || user.email.split("@")[0];

          await db.insert(schema.organization).values({
            id: orgId,
            name: `${firstName}'s Org`,
            slug: `${baseSlug}-${orgId.slice(0, 8)}`,
            createdAt: now,
          });
          await db.insert(schema.member).values({
            id: crypto.randomUUID(),
            organizationId: orgId,
            userId: user.id,
            role: "owner",
            createdAt: now,
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          if (!session.userId) {
            return;
          }

          const members = await db
            .select()
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .limit(1);
          const found = members?.[0];

          return {
            data: {
              ...session,
              ...(found?.organizationId && {
                activeOrganizationId: found.organizationId,
              }),
            },
          };
        },
      },
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    organization(),
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        await EmailService.send({
          type: EmailServiceType.SIGN_IN,
          to: email,
          args: { otp },
        });
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
});
