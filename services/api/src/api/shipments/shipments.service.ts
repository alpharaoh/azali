import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { aggregateShipmentStats } from "@/db/queries/aggregate/aggregateShipmentStats";
import { deleteShipment } from "@/db/queries/delete/deleteShipment";
import { insertShipment } from "@/db/queries/insert/insertShipment";
import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { listShipmentEvents } from "@/db/queries/select/many/listShipmentEvents";
import { listShipmentLineItems } from "@/db/queries/select/many/listShipmentLineItems";
import { listShipments } from "@/db/queries/select/many/listShipments";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { updateProduct } from "@/db/queries/update/updateProduct";
import { updateShipment } from "@/db/queries/update/updateShipment";
import { updateShipmentLineItem } from "@/db/queries/update/updateShipmentLineItem";
import { LineItemStatus } from "@/db/schemas/shipmentLineItems";
import {
  ShipmentSource,
  ShipmentStage,
  ShipmentStatus,
} from "@/db/schemas/shipments";
import { inngest } from "@/inngest/client";
import { SHIPMENT_CLASSIFY_REQUESTED_EVENT } from "@/inngest/functions/classifyShipment";
import { EMAIL_INTAKE_SKIP_REQUESTED_EVENT } from "@/inngest/functions/finalizeEmailShipment";
import { createLogger } from "@/lib/logger";
import { confidenceBandForScore } from "@/services/agents/classification/schema";
import { indexAndDedupeClassification } from "@/services/external/pinecone/classificationRecord";
import type { CreateShipmentDto } from "./dto/create-shipment.dto";
import type { ListShipmentsDto } from "./dto/list-shipments.dto";
import {
  type ResolveReviewDto,
  ReviewResolutionAction,
} from "./dto/resolve-review.dto";
import type { UpdateShipmentDto } from "./dto/update-shipment.dto";

const STAGE_ORDER: ShipmentStage[] = [
  ShipmentStage.Intake,
  ShipmentStage.Classification,
  ShipmentStage.Compliance,
  ShipmentStage.Entry,
  ShipmentStage.Filed,
  ShipmentStage.Released,
];

function advanceStage(stage: ShipmentStage): ShipmentStage {
  const index = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[Math.min(index + 1, STAGE_ORDER.length - 1)] ?? stage;
}

function statusForStage(stage: ShipmentStage): ShipmentStatus {
  if (stage === ShipmentStage.Released) return ShipmentStatus.Released;
  if (stage === ShipmentStage.Filed) return ShipmentStatus.AwaitingCbp;
  return ShipmentStatus.Autopilot;
}

const calibrationLog = createLogger("classification-calibration");

/**
 * The calibration eval hook: every broker verification emits one
 * (confidence, verified outcome) pair, scraped downstream into reliability
 * diagrams / Brier scores per rubric band. Watch two signals: the
 * 0.83–0.92 band's hit rate (target >= 85%) and whether 0.50–0.67 holds the
 * genuinely contested cases rather than lazily-researched routine ones.
 */
function recordCalibrationOutcome(
  line: {
    id: string;
    htsCode: string | null;
    confidence: number | null;
    classificationRunId: string | null;
    reusedFromProduct: boolean | null;
  },
  shipmentId: string,
  verifiedHts: string,
) {
  // Reused lines carry a confidence minted by an earlier run — logging them
  // again would double-count that run's calibration.
  if (line.reusedFromProduct || line.htsCode === null) return;
  if (line.confidence === null) return;
  calibrationLog.info(
    {
      event: "classification_calibration_outcome",
      shipmentId,
      lineItemId: line.id,
      runId: line.classificationRunId,
      proposedHts: line.htsCode,
      verifiedHts,
      confidence: line.confidence,
      band: confidenceBandForScore(line.confidence),
      correct: verifiedHts === line.htsCode,
    },
    "classification calibration outcome",
  );
}

function toInsertValues<T extends { etaAt?: string | null }>(dto: T) {
  const { etaAt, ...rest } = dto;

  return {
    ...rest,
    ...(etaAt !== undefined && { etaAt: etaAt ? new Date(etaAt) : null }),
  };
}

@Injectable()
export class ShipmentsService {
  async create(organizationId: string, userId: string, dto: CreateShipmentDto) {
    return insertShipment({
      ...toInsertValues(dto),
      organizationId,
      userId,
    });
  }

  async findAll(organizationId: string, query: ListShipmentsDto) {
    const {
      limit,
      offset,
      sortBy,
      sortDir,
      search,
      stage,
      status,
      clientId,
      reviewType,
      valueMin,
      valueMax,
    } = query;

    return listShipments(
      {
        organizationId,
        search,
        stages: stage,
        statuses: status,
        clientIds: clientId,
        reviewTypes: reviewType,
        valueMinCents: valueMin,
        valueMaxCents: valueMax,
      },
      { [sortBy]: sortDir },
      limit,
      offset,
    );
  }

  async stats(organizationId: string) {
    const rows = await aggregateShipmentStats(organizationId);
    const byStatus: Record<ShipmentStatus, number> = {
      [ShipmentStatus.Autopilot]: 0,
      [ShipmentStatus.NeedsReview]: 0,
      [ShipmentStatus.AwaitingCbp]: 0,
      [ShipmentStatus.Released]: 0,
    };
    const byReviewType: Record<string, number> = {};
    let total = 0;

    for (const row of rows) {
      total += row.count;
      byStatus[row.status] += row.count;
      if (row.reviewType) {
        byReviewType[row.reviewType] =
          (byReviewType[row.reviewType] ?? 0) + row.count;
      }
    }

    return { byReviewType, byStatus, total };
  }

  async findOne(organizationId: string, id: string) {
    const shipment = await selectShipment(id, organizationId);
    if (!shipment) {
      throw new NotFoundException(`Shipment "${id}" not found`);
    }

    return shipment;
  }

  async update(organizationId: string, id: string, dto: UpdateShipmentDto) {
    const shipment = await updateShipment(
      id,
      organizationId,
      toInsertValues(dto),
    );
    if (!shipment) {
      throw new NotFoundException(`Shipment "${id}" not found`);
    }

    return shipment;
  }

  async remove(organizationId: string, id: string) {
    const shipment = await deleteShipment(id, organizationId);
    if (!shipment) {
      throw new NotFoundException(`Shipment "${id}" not found`);
    }

    return shipment;
  }

  /**
   * Resolve the open review on a shipment: append a review_resolved event
   * (audit trail), then advance the stage and recompute the denormalized
   * status columns. "info_requested" keeps the shipment in the queue.
   */
  async resolveReview(
    organizationId: string,
    userId: string,
    id: string,
    dto: ResolveReviewDto,
  ) {
    const shipment = await this.findOne(organizationId, id);

    if (shipment.status !== ShipmentStatus.NeedsReview) {
      throw new ConflictException(
        `Shipment "${id}" has no pending review to resolve`,
      );
    }

    const correctedSuffix = dto.corrections?.length
      ? ` → ${dto.corrections.length} line${dto.corrections.length === 1 ? "" : "s"}`
      : dto.alternate
        ? ` → ${dto.alternate}`
        : "";
    const titles: Record<ReviewResolutionAction, string> = {
      [ReviewResolutionAction.Approved]: "Review approved",
      [ReviewResolutionAction.Corrected]: `Review corrected${correctedSuffix}`,
      [ReviewResolutionAction.InfoRequested]: "More information requested",
    };

    await insertShipmentEvent({
      organizationId,
      userId,
      shipmentId: shipment.id,
      type: "review_resolved",
      actor: "user",
      title: titles[dto.action],
      payload: {
        action: dto.action,
        ...(dto.alternate && { alternate: dto.alternate }),
        ...(dto.corrections?.length && { corrections: dto.corrections }),
        ...(dto.note && { note: dto.note }),
      },
    });

    if (dto.action === ReviewResolutionAction.InfoRequested) {
      return shipment;
    }

    await this.applyResolutionToLines(organizationId, id, dto);

    const nextStage = advanceStage(shipment.stage);

    const updated = await updateShipment(id, organizationId, {
      stage: nextStage,
      status: statusForStage(nextStage),
      reviewDeadlineAt: null,
      reviewType: null,
    });

    return updated ?? shipment;
  }

  /**
   * Land the resolution on the line items and product library: the reviewed
   * line is approved or corrected (a correction also updates the product as
   * broker-confirmed — future shipments of that product reuse it); the
   * remaining classified lines are approved. Shipments without line items
   * (seeded demos) skip untouched.
   */
  private async applyResolutionToLines(
    organizationId: string,
    shipmentId: string,
    dto: ResolveReviewDto,
  ) {
    const { data: reviewEvents } = await listShipmentEvents(
      { organizationId, shipmentId, types: ["review_requested"] },
      { occurredAt: "desc" },
      1,
    );
    const payload = reviewEvents[0]?.payload as
      | { lineItemId?: string }
      | undefined;
    const { data: lines } = await listShipmentLineItems({
      organizationId,
      shipmentId,
    });
    if (lines.length === 0) return;

    // Per-line substitutions; the legacy single-alternate form corrects the
    // reviewed (headline) line.
    const substitutions = new Map<string, string>(
      dto.corrections?.map((c) => [c.lineItemId, c.alternate]) ?? [],
    );
    if (substitutions.size === 0 && dto.alternate && payload?.lineItemId) {
      substitutions.set(payload.lineItemId, dto.alternate);
    }

    for (const line of lines) {
      const alternate = substitutions.get(line.id);

      if (dto.action === ReviewResolutionAction.Corrected && alternate) {
        recordCalibrationOutcome(line, shipmentId, alternate);
        await updateShipmentLineItem(line.id, organizationId, {
          htsCode: alternate,
          status: LineItemStatus.Corrected,
        });
        if (line.productId) {
          const product = await updateProduct(line.productId, organizationId, {
            htsCode: alternate,
            // The old description/duty belong to the rejected code — null
            // them rather than let a reuse carry a mismatched snapshot.
            htsDescription: null,
            dutyRate: null,
            confidence: 1,
            classifiedAt: new Date(),
            source: "broker",
          });
          await indexAndDedupeClassification(product);
        }
        continue;
      }

      if (
        line.status === LineItemStatus.Classified ||
        line.status === LineItemStatus.NeedsReview
      ) {
        if (line.htsCode) {
          recordCalibrationOutcome(line, shipmentId, line.htsCode);
        }
        await updateShipmentLineItem(line.id, organizationId, {
          status: LineItemStatus.Approved,
        });
        // Approving the review confirms every line the broker saw in the
        // table — their products become broker-verified and reusable.
        if (line.productId) {
          const product = await updateProduct(line.productId, organizationId, {
            source: "broker",
            classifiedAt: new Date(),
          });
          await indexAndDedupeClassification(product);
        }
      }
    }
  }

  /** The shipment's entry lines with their full classification snapshot —
   * the line row is the single source of per-line truth. */
  async lines(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    const { data } = await listShipmentLineItems({
      organizationId,
      shipmentId: id,
    });
    return {
      lines: data.map((line) => {
        const dutyRate = line.dutyRate as {
          effective?: string | null;
          effectivePct?: number | null;
        } | null;
        const effectivePct = dutyRate?.effectivePct ?? null;
        return {
          id: line.id,
          lineNumber: line.lineNumber,
          description: line.description,
          sku: line.sku,
          quantity: line.quantity,
          unit: line.unit,
          totalValueUsd:
            line.totalValueCents === null ? null : line.totalValueCents / 100,
          originCountry: line.originCountry,
          htsCode: line.htsCode,
          confidence: line.confidence,
          status: line.status,
          reusedFromProduct: line.reusedFromProduct,
          productId: line.productId,
          runId: line.classificationRunId,
          summary: line.summary ?? line.htsDescription,
          duty:
            line.htsCode === null
              ? null
              : {
                  effectivePct,
                  label: dutyRate?.effective ?? null,
                  amountUsd:
                    effectivePct !== null && line.totalValueCents !== null
                      ? Math.round(
                          (line.totalValueCents / 100) * (effectivePct / 100),
                        )
                      : null,
                },
          alternates: line.alternates,
        };
      }),
    };
  }

  /**
   * Fast-forward an email-sourced shipment's intake window: the broker
   * asserts all related emails are in. Closes the attribution window
   * immediately (later emails start a fresh shipment) and signals the
   * waiting finalize run to proceed to classification.
   */
  async skipEmailIntake(organizationId: string, userId: string, id: string) {
    const shipment = await this.findOne(organizationId, id);
    const windowOpen =
      shipment.source === ShipmentSource.Email &&
      shipment.emailIntakeExpiresAt !== null &&
      shipment.emailIntakeExpiresAt > new Date();
    if (!windowOpen) {
      throw new ConflictException(
        `Shipment "${id}" has no open email intake window to skip`,
      );
    }

    await updateShipment(id, organizationId, {
      emailIntakeExpiresAt: new Date(),
    });
    await insertShipmentEvent({
      organizationId,
      userId,
      shipmentId: id,
      type: "email_intake_skipped",
      actor: "user",
      title: "Email intake window skipped — proceeding to classification",
      payload: {},
    });
    await inngest.send({
      name: EMAIL_INTAKE_SKIP_REQUESTED_EVENT,
      data: { organizationId, userId, shipmentId: id },
    });

    return { skipped: true };
  }

  /** Kick off an asynchronous classification run for a shipment. */
  async classify(organizationId: string, userId: string, id: string) {
    const shipment = await selectShipment(id, organizationId);
    if (!shipment) {
      throw new NotFoundException(`Shipment "${id}" not found`);
    }

    const result = await inngest.send({
      name: SHIPMENT_CLASSIFY_REQUESTED_EVENT,
      data: { organizationId, userId, shipmentId: id },
    });

    return { eventIds: result.ids };
  }
}
