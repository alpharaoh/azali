import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { selectActiveMembership } from "@/db/queries/select/one/selectActiveMembership";
import { selectOrganizationBySlug } from "@/db/queries/select/one/selectOrganizationBySlug";
import { updateOrganization } from "@/db/queries/update/updateOrganization";
import type { UpdateOrganizationDto } from "./dto/update-organization.dto";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      // Apostrophes and quotes disappear ("Akaam's" → "akaams"), and stray
      // combining marks from NFKD go with them.
      .replace(/['’‘"“”]/g, "")
      .replace(/[\u{0300}-\u{036F}]/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "org"
  );
}

@Injectable()
export class OrganizationService {
  async getCurrent(organizationId: string, userId: string) {
    const membership = await selectActiveMembership(userId, organizationId);
    if (!membership?.organization) {
      throw new NotFoundException("Organization not found");
    }

    return membership.organization;
  }

  async updateCurrent(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ) {
    const membership = await selectActiveMembership(userId, organizationId);
    if (!membership?.organization) {
      throw new NotFoundException("Organization not found");
    }
    if (!["owner", "admin"].includes(membership.role)) {
      throw new ForbiddenException(
        "Only owners and admins can update the organization",
      );
    }

    // Slug is derived from the name; disambiguate only on collision.
    const base = slugify(dto.name);
    const taken = await selectOrganizationBySlug(base);
    const slug =
      !taken || taken.id === organizationId
        ? base
        : `${base}-${organizationId.slice(0, 8)}`;

    return updateOrganization(organizationId, {
      name: dto.name,
      slug,
      description: dto.description ?? null,
      website: dto.website ?? null,
      contactEmail: dto.contactEmail ?? null,
      filerCode: dto.filerCode ? dto.filerCode.toUpperCase() : null,
    });
  }
}
