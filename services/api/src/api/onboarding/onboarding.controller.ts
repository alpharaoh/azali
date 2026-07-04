import { Body, Controller, Post } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  user,
  organization,
  member,
  session as sessionTable,
} from "@/db/schema";

const CompleteOnboardingSchema = z.object({
  name: z.string().min(1),
  teamName: z.string().min(1),
  industry: z.string().min(1),
  companySize: z.string().min(1),
  primaryUse: z.string().min(1),
  role: z.string().min(1),
});

class CompleteOnboardingDto extends createZodDto(CompleteOnboardingSchema) {}

function slugify(str: string): string {
  const base = str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

@Controller("onboarding")
export class OnboardingController {
  @Post("complete")
  async complete(
    @Session() session: UserSession,
    @Body() body: CompleteOnboardingDto,
  ) {
    const {
      name,
      teamName,
      industry,
      companySize,
      primaryUse,
      role: companyRole,
    } = body;

    const doInsert = async (slug: string) => {
      await db.transaction(async (tx) => {
        await tx.update(user).set({ name }).where(eq(user.id, session.user.id));

        const orgId = crypto.randomUUID();
        await tx.insert(organization).values({
          id: orgId,
          name: teamName,
          slug,
          createdAt: new Date(),
          metadata: JSON.stringify({ industry, companySize, primaryUse }),
        });

        await tx.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: orgId,
          userId: session.user.id,
          role: "owner",
          createdAt: new Date(),
          metadata: { role: companyRole },
        });

        await tx
          .update(sessionTable)
          .set({ activeOrganizationId: orgId })
          .where(eq(sessionTable.userId, session.user.id));
      });
    };

    try {
      await doInsert(slugify(teamName));
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Error && "code" in err && err.code === "23505";
      if (isUniqueViolation) {
        await doInsert(slugify(teamName));
      } else {
        throw err;
      }
    }

    return { success: true };
  }
}
