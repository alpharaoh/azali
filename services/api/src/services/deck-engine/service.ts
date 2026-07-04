import { Injectable } from "@nestjs/common";
import {
  getDeckEngineV1,
  type CreateSessionResponse,
  type ApplyOperationsResponse,
} from "@/generated/deck-engine";

@Injectable()
export class DeckEngineService {
  private client = getDeckEngineV1();

  async createSession(s3Key: string): Promise<CreateSessionResponse> {
    return await this.client.postSessions({ data: { s3Key } });
  }

  async applyOperations(
    sessionId: string,
    operations: unknown[],
  ): Promise<ApplyOperationsResponse> {
    return await this.client.postSessionsIdOperations(sessionId, {
      data: operations,
    });
  }

  async exportSession(sessionId: string) {
    return await this.client.getSessionsIdExport(sessionId, {
      responseType: "arraybuffer",
    });
  }

  async getImage(
    sessionId: string,
    slideDeckId: number | string,
    shapeId: number | string,
  ) {
    return await this.client.getSessionsIdImagesSlideDeckIdShapeId(
      sessionId,
      slideDeckId,
      shapeId,
      { responseType: "arraybuffer" },
    );
  }

}
