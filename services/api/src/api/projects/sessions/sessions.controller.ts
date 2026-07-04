import { Controller, Get, Param, Post, Body, Res } from "@nestjs/common";
import { ApiOkResponse, ApiProduces } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { DeckEngineService } from "@/services/deck-engine/service";
import {
  CreateSessionDto,
  CreateSessionResponseDto,
  ApplyOperationsDto,
  ApplyOperationsResponseDto,
} from "./sessions.dto";

@Controller("projects")
export class SessionsController {
  constructor(private readonly deckEngine: DeckEngineService) {}

  @Post("sessions")
  @ApiOkResponse({ type: CreateSessionResponseDto })
  async createSession(
    @Session() _session: UserSession,
    @Body() body: CreateSessionDto,
  ) {
    return this.deckEngine.createSession(body.s3Key);
  }

  @Post("sessions/:id/operations")
  @ApiOkResponse({ type: ApplyOperationsResponseDto })
  async applyOperations(
    @Session() _session: UserSession,
    @Param("id") id: string,
    @Body() body: ApplyOperationsDto,
  ) {
    return this.deckEngine.applyOperations(id, body.operations);
  }

  @Get("sessions/:id/export")
  @ApiProduces(
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  )
  async exportSession(
    @Session() _session: UserSession,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const data = await this.deckEngine.exportSession(id);
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": 'attachment; filename="presentation.pptx"',
    });
    res.send(Buffer.from(data as unknown as ArrayBuffer));
  }

  @Get("sessions/:id/images/:slideDeckId/:shapeId")
  async getImage(
    @Session() _session: UserSession,
    @Param("id") id: string,
    @Param("slideDeckId") slideDeckId: string,
    @Param("shapeId") shapeId: string,
    @Res() res: Response,
  ) {
    const data = await this.deckEngine.getImage(id, slideDeckId, shapeId);
    res.set({ "Content-Type": "application/octet-stream" });
    res.send(Buffer.from(data as unknown as ArrayBuffer));
  }
}
