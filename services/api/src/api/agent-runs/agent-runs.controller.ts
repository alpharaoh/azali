import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import { AgentRunsService } from "./agent-runs.service";
import {
  AgentRunDetailResponseDto,
  ListAgentRunsResponseDto,
} from "./dto/agent-run.response.dto";

@ApiTags("AI Runs")
@Controller()
export class AgentRunsController {
  constructor(private readonly agentRunsService: AgentRunsService) {}

  /** Run summaries for one shipment. */
  @Get("shipments/:id/runs")
  @ApiOperation({
    summary: "List a shipment's AI runs",
    description:
      "Returns the AI runs performed for a shipment — what ran, its status, the result, and how much work it took. Use the run id to fetch the complete audit record.",
  })
  @ApiParam({ name: "id", description: "Shipment id." })
  @ApiOkResponse({
    type: ListAgentRunsResponseDto,
    description: "The shipment's AI runs, newest first.",
  })
  list(@Session() session: UserSession<typeof auth>, @Param("id") id: string) {
    return this.agentRunsService.listForShipment(
      getActiveOrganizationId(session),
      id,
    );
  }

  /** The full audit record of one run. */
  @Get("runs/:id")
  @ApiOperation({
    summary: "Get an AI run's audit record",
    description:
      "Returns the complete audit record of an AI run: every reasoning passage, every research action with its inputs, and everything it found — in the order it happened. This is the record behind each AI decision.",
  })
  @ApiParam({ name: "id", description: "Run id." })
  @ApiOkResponse({
    type: AgentRunDetailResponseDto,
    description: "The run and its full ordered record.",
  })
  find(@Session() session: UserSession<typeof auth>, @Param("id") id: string) {
    return this.agentRunsService.find(getActiveOrganizationId(session), id);
  }
}
