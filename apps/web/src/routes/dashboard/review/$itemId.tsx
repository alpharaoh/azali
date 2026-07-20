import { createFileRoute, redirect } from "@tanstack/react-router";

/** The review detail pane moved into the shipment page — old deep links
 * (bookmarks, emails) land there instead. */
export const Route = createFileRoute("/dashboard/review/$itemId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      params: { shipmentId: params.itemId },
      to: "/dashboard/shipments/$shipmentId",
    });
  },
});
