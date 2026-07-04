import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { emailOTP, organization } from "better-auth/plugins";
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
  experimental: { joins: true },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  databaseHooks: {
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
