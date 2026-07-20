import {
  IconCurrencyDollar,
  IconFileText,
  IconLaw,
  IconPageCheck,
  IconShieldCheck,
  IconTag,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { differenceInHours } from "date-fns";
import type { ComponentType } from "react";
import type { ReviewItemType } from "#/lib/review-types";

/* -------------------------------------------------------------------------------------------------
 * Review meta — the type/deadline vocabulary shared by the queue list, the
 * home todo list, and the shipment page's review surface.
 * -----------------------------------------------------------------------------------------------*/
type TypeIconComponent = ComponentType<{
  className?: string;
  mode?: "masked" | "raw";
}>;

export const typeMeta: Record<
  ReviewItemType,
  { label: string; icon: TypeIconComponent }
> = {
  classification: { icon: IconTag, label: "Classification" },
  document: { icon: IconFileText, label: "Document" },
  enforcement: { icon: IconShieldCheck, label: "Enforcement" },
  pga: { icon: IconLaw, label: "PGA" },
  signoff: { icon: IconPageCheck, label: "Sign-off" },
  valuation: { icon: IconCurrencyDollar, label: "Valuation" },
};

export type DeadlineTone = "danger" | "default" | "warning";

export function deadlineTone(deadline: Date): DeadlineTone {
  const hoursLeft = differenceInHours(deadline, new Date());

  return hoursLeft <= 4 ? "danger" : hoursLeft <= 24 ? "warning" : "default";
}

/** Deadline text color per tone. */
export const deadlineTextClass: Record<DeadlineTone, string> = {
  danger: "text-danger font-medium",
  default: "text-muted",
  warning: "text-warning",
};
