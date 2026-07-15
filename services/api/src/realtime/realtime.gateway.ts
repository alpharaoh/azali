import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { fromNodeHeaders } from "better-auth/node";
import type { Server, Socket } from "socket.io";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { type RealtimeEvents, realtimeBus } from "./bus";

type OrgSocket = Socket & { data: { organizationId?: string } };

/** Events that fan out to the shipment's own room (org id stripped). */
const SHIPMENT_ROOM_EVENTS = [
  "shipment.event",
  "document.changed",
  "line.changed",
  "run.started",
  "run.item",
  "run.finished",
] as const satisfies ReadonlyArray<keyof RealtimeEvents>;

/**
 * Streams pipeline activity to the browser. Every authenticated socket sits
 * in its organization's room (list-level refresh signals); viewing a
 * shipment additionally joins its room for the granular stream — timeline
 * events, document/line updates, and the live agent trace.
 */
@WebSocketGateway({
  namespace: "/realtime",
  // enableCors() in main.ts covers HTTP routes only — the engine.io
  // handshake needs its own CORS config.
  cors: { origin: env.TRUSTED_ORIGINS, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  afterInit() {
    // Bus → rooms, registered once (the gateway is a singleton).
    realtimeBus.on("shipment.changed", ({ organizationId, shipmentId }) => {
      this.server
        .to(`org:${organizationId}`)
        .emit("shipment.changed", { shipmentId });
    });
    for (const name of SHIPMENT_ROOM_EVENTS) {
      realtimeBus.on(name, (payload) => {
        const { organizationId: _routing, ...wire } = payload;
        this.server.to(`shipment:${payload.shipmentId}`).emit(name, wire);
      });
    }
  }

  // Nest guards do not run on the connection handshake — resolve the
  // better-auth session from the handshake cookie exactly as the HTTP
  // guard does, and drop unauthenticated sockets.
  async handleConnection(socket: OrgSocket) {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(socket.handshake.headers),
      });
      const organizationId = session?.session.activeOrganizationId;
      if (!organizationId) {
        socket.disconnect(true);
        return;
      }
      socket.data.organizationId = organizationId;
      await socket.join(`org:${organizationId}`);
    } catch (error) {
      this.logger.warn(
        `realtime handshake failed: ${error instanceof Error ? error.message : error}`,
      );
      socket.disconnect(true);
    }
  }

  @SubscribeMessage("shipment.subscribe")
  async subscribe(
    @ConnectedSocket() socket: OrgSocket,
    @MessageBody() body: { shipmentId?: string },
  ) {
    const organizationId = socket.data.organizationId;
    if (!organizationId || typeof body?.shipmentId !== "string") {
      return { ok: false };
    }
    // The org check IS the authorization — wrong-org (or deleted) shipments
    // are refused without acknowledging they exist.
    const shipment = await selectShipment(body.shipmentId, organizationId);
    if (!shipment) return { ok: false };
    await socket.join(`shipment:${body.shipmentId}`);
    return { ok: true };
  }

  @SubscribeMessage("shipment.unsubscribe")
  async unsubscribe(
    @ConnectedSocket() socket: OrgSocket,
    @MessageBody() body: { shipmentId?: string },
  ) {
    if (typeof body?.shipmentId === "string") {
      await socket.leave(`shipment:${body.shipmentId}`);
    }
    return { ok: true };
  }
}
