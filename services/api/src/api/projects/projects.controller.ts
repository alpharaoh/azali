import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { insertProject } from "@/db/queries/insert/insertProject";
import { selectProject } from "@/db/queries/select/one/selectProject";
import { listProjects } from "@/db/queries/select/many/listProjects";
import { updateProject } from "@/db/queries/update/updateProject";
import {
  CreateProjectDto,
  CreateProjectResponseDto,
  UpdateProjectDto,
} from "./projects.dto";

function getOrgId(session: UserSession): string {
  const orgId = session.session.activeOrganizationId;
  if (!orgId) throw new BadRequestException("No active organization");
  return orgId;
}

@Controller("projects")
export class ProjectsController {
  @Post()
  @ApiOkResponse({ type: CreateProjectResponseDto })
  async create(
    @Session() session: UserSession,
    @Body() body: CreateProjectDto,
  ) {
    const organizationId = getOrgId(session);
    return insertProject({
      organizationId,
      userId: session.user.id,
      sourceS3Key: body.sourceS3Key,
      name: body.name ?? null,
    });
  }

  @Get()
  async list(@Session() session: UserSession) {
    const organizationId = getOrgId(session);
    return listProjects({ organizationId });
  }

  @Get(":id")
  async get(@Session() session: UserSession, @Param("id") id: string) {
    const organizationId = getOrgId(session);
    const project = await selectProject(id, organizationId);
    if (!project) throw new BadRequestException("Project not found");
    return project;
  }

  @Patch(":id")
  async update(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body() body: UpdateProjectDto,
  ) {
    const organizationId = getOrgId(session);
    const project = await updateProject(id, organizationId, body);
    if (!project) throw new BadRequestException("Project not found");
    return project;
  }

  @Delete(":id")
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const organizationId = getOrgId(session);
    const project = await updateProject(id, organizationId, {
      deletedAt: new Date(),
    });
    if (!project) throw new BadRequestException("Project not found");
    return { success: true };
  }
}
