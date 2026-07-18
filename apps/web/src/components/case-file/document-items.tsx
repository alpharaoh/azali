import {
  IconBell,
  IconChecklist,
  IconEmail1,
  IconFileText,
  IconGovernment,
  IconPackage,
  IconPencil,
  IconReceiptBill,
  IconShip,
  IconSquareArrowTopRight,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button, Spinner, Tabs } from "@heroui/react";
import { Timeline } from "@heroui-pro/react";
import type { ComponentType, ReactNode } from "react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReviewDocument } from "#/lib/review-types";
import { DocumentLineRow, DocumentViewerModal } from "./document-viewer-modal";
import { receivedAgo, type TimelineItemPassthrough } from "./timeline-items";

export function DocumentsTimelineItem({
  documents,
  onEditDraft,
  ...rest
}: {
  documents: ReviewDocument[];
  onEditDraft?: (document: ReviewDocument & { kind: "pdf" }) => void;
} & TimelineItemPassthrough) {
  return (
    <Timeline.Item align="start" status="default" {...rest}>
      <Timeline.Marker aria-hidden="true" className="size-6">
        <IconFileText className="text-muted size-3.5" />
      </Timeline.Marker>
      <Timeline.Content className="gap-2">
        <Tabs className="min-w-0 max-w-full" variant="secondary">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Shipment documents" className="max-w-full">
              {documents.map((document, index) => {
                const { Icon, label } = docTabMeta(document);

                return (
                  <Tabs.Tab
                    // biome-ignore lint/suspicious/noArrayIndexKey: static per-shipment doc set
                    key={index}
                    id={`doc-${index}`}
                    className="w-fit whitespace-nowrap"
                  >
                    <Icon className="size-3.5 mr-1.5" />
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>
          </Tabs.ListContainer>
          {documents.map((document, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static per-shipment doc set
            <Tabs.Panel key={index} className="pt-2" id={`doc-${index}`}>
              <DocumentBody
                document={document}
                onEditDraft={
                  document.kind === "pdf" && document.draft && onEditDraft
                    ? () =>
                        onEditDraft(
                          document as ReviewDocument & { kind: "pdf" },
                        )
                    : undefined
                }
              />
            </Tabs.Panel>
          ))}
        </Tabs>
      </Timeline.Content>
    </Timeline.Item>
  );
}

/** A standalone document beat (CBP correspondence, drafted responses). */
export function SingleDocumentTimelineItem({
  document,
  onEditDraft,
  ...rest
}: {
  document: ReviewDocument;
  onEditDraft?: () => void;
} & TimelineItemPassthrough) {
  const isCbpForm =
    document.kind !== "email" && /cbp form 2[89]/i.test(document.name);
  const title = document.kind === "email" ? document.subject : document.name;

  return (
    <Timeline.Item align="start" status="default" {...rest}>
      <Timeline.Marker
        aria-hidden="true"
        className={`size-6 ${
          isCbpForm
            ? "border-purple-500/40 bg-purple-500/15 text-purple-600 dark:text-purple-400"
            : ""
        }`}
      >
        {document.kind === "email" ? (
          <IconEmail1 className={`size-3.5 ${isCbpForm ? "" : "text-muted"}`} />
        ) : (
          <IconFileText
            className={`size-3.5 ${isCbpForm ? "" : "text-muted"}`}
          />
        )}
      </Timeline.Marker>
      <Timeline.Content className="gap-2">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <h3 className="text-foreground m-0 min-w-0 truncate text-xs font-medium leading-5">
            {title}
          </h3>
          <time className="text-muted shrink-0 text-xs leading-5">
            {receivedAgo(document.receivedHoursAgo)}
          </time>
        </div>
        <DocumentBody document={document} onEditDraft={onEditDraft} />
      </Timeline.Content>
    </Timeline.Item>
  );
}

// Matches space, dash, underscore, dot, or nothing between words
const SEP = "[\\s_.-]*";

const matchers: Array<{ pattern: RegExp; Icon: any; label: string }> = [
  {
    pattern: new RegExp(`cbp${SEP}form${SEP}28|cf${SEP}28`, "i"),
    Icon: IconGovernment,
    label: "CF-28",
  },
  {
    pattern: new RegExp(`cbp${SEP}form${SEP}29|cf${SEP}29`, "i"),
    Icon: IconGovernment,
    label: "CF-29",
  },
  {
    pattern: /draft${SEP}response|response/i,
    Icon: IconPencil,
    label: "Response Draft",
  }, // see note below
  { pattern: /invoice/i, Icon: IconReceiptBill, label: "Invoice" },
  { pattern: /packing/i, Icon: IconPackage, label: "Packing List" },
  {
    pattern: new RegExp(`bill${SEP}of${SEP}lading|b/?l|awb`, "i"),
    Icon: IconShip,
    label: "Bill of Lading",
  },
  { pattern: /arrival/i, Icon: IconBell, label: "Arrival Notice" },
  { pattern: /spec/i, Icon: IconChecklist, label: "Spec Sheet" },
];

function getDocMeta(name: string) {
  return matchers.find((m) => m.pattern.test(name))?.label ?? name;
}

/** Tab label + icon for a document, inferred from what it is. */
function docTabMeta(document: ReviewDocument): {
  label: string;
  Icon: ComponentType<{ className?: string }>;
} {
  if (document.kind === "email") return { Icon: IconEmail1, label: "Email" };

  const name = getDocMeta(document.name);

  return {
    Icon: IconFileText,
    label: name.length > 22 ? `${name.slice(0, 22)}…` : name,
  };
}

/** One document's content — draft letter, real PDF + extraction, email, or fields. */
function DocumentBody({
  document,
  onEditDraft,
}: {
  document: ReviewDocument;
  onEditDraft?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {document.kind === "pdf" && document.draft ? (
        <DraftDocumentPreview document={document} onView={onEditDraft} />
      ) : document.kind === "email" ? (
        <>
          <span className="text-muted text-xs">
            From: {document.from} · {document.meta}
          </span>
          <p className="bg-background/40 text-foreground rounded-lg border p-3 text-xs leading-relaxed">
            {document.body}
          </p>
        </>
      ) : document.kind === "pdf" ? (
        <PdfWithExtraction document={document} />
      ) : (
        <>
          <a
            className="block"
            href={document.src}
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt={document.name}
              className="max-h-80 w-full rounded-lg border bg-white object-contain"
              src={document.src}
            />
          </a>
          <div className="bg-background/40 flex flex-col gap-0.5 rounded-lg border p-3 font-mono text-xs leading-relaxed">
            {document.extracted.map((line) => (
              <DocumentLineRow key={line.label} line={line} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Draft letter preview — the agent-drafted response rendered as a document,
 * capped and faded; the full text opens in the editor.
 * -----------------------------------------------------------------------------------------------*/
interface DraftNode {
  type?: string;
  text?: string;
  marks?: Array<{ type: string }>;
  attrs?: { level?: number };
  content?: DraftNode[];
}

function renderDraftInline(node: DraftNode, key: number): ReactNode {
  let element: ReactNode = node.text ?? "";

  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") element = <strong>{element}</strong>;
    else if (mark.type === "italic") element = <em>{element}</em>;
  }

  return <Fragment key={key}>{element}</Fragment>;
}

function renderDraftBlocks(nodes: DraftNode[]): ReactNode {
  // biome-ignore-start lint/suspicious/noArrayIndexKey: draft nodes carry no stable ids and the list is render-only
  return nodes.map((node, index) => {
    const inline = (node.content ?? []).map(renderDraftInline);

    switch (node.type) {
      case "heading":
        return (node.attrs?.level ?? 2) <= 2 ? (
          <h4
            key={index}
            className="text-foreground mt-1 text-sm font-semibold"
          >
            {inline}
          </h4>
        ) : (
          <h5
            key={index}
            className="text-foreground mt-1 text-xs font-semibold"
          >
            {inline}
          </h5>
        );
      case "bulletList":
        return (
          <ul key={index} className="flex list-disc flex-col gap-1 pl-4">
            {(node.content ?? []).map((item, itemIndex) => (
              <li key={itemIndex}>
                {(item.content?.[0]?.content ?? []).map(renderDraftInline)}
              </li>
            ))}
          </ul>
        );
      default:
        return <p key={index}>{inline}</p>;
    }
  });
  // biome-ignore-end lint/suspicious/noArrayIndexKey: draft nodes carry no stable ids
}

function DraftDocumentPreview({
  document,
  onView,
}: {
  document: ReviewDocument & { kind: "pdf" };
  onView?: () => void;
}) {
  const content =
    (document.draft as { content?: DraftNode[] } | undefined)?.content ?? [];

  return (
    <div className="bg-background/40 relative max-h-80 overflow-hidden rounded-lg border">
      <div className="text-muted flex flex-col gap-2 p-4 pb-8 text-xs leading-relaxed [mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]">
        {renderDraftBlocks(content)}
      </div>
      {onView ? (
        <button
          aria-label="View full response"
          className="group absolute inset-0 cursor-pointer"
          type="button"
          onClick={onView}
        >
          <span className="bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100">
            <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
              <IconPencil className="size-3.5" />
              View full response
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Inline preview of a real PDF beside what the AI extracted from it. The
 * preview is deliberately non-interactive — "View document" opens the full
 * viewer with the complete extraction.
 */
function PdfWithExtraction({
  document,
}: {
  document: ReviewDocument & { kind: "pdf"; src?: string };
}) {
  const [isViewerOpen, setViewerOpen] = useState(false);
  const [isPreviewLoaded, setPreviewLoaded] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const lines = document.lines;
  // Page count lives in the document meta ("… · 3 pages") — the preview
  // always shows page one.
  const pageCount = /(\d+)\s+pages?/i.exec(document.meta)?.[1] ?? null;
  // How many extracted-field rows the item cap clips off, measured for real
  // so the "N more fields" hint is always accurate.
  const fieldsRegionRef = useRef<HTMLDivElement>(null);
  const [hiddenFields, setHiddenFields] = useState(0);

  useEffect(() => {
    const region = fieldsRegionRef.current;
    if (!region) return;

    const update = () => {
      let hidden = 0;
      for (const row of region.querySelectorAll<HTMLElement>(
        "[data-field-row]",
      )) {
        if (row.offsetTop + row.offsetHeight > region.clientHeight) {
          hidden += 1;
        }
      }
      setHiddenFields(hidden);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(region);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* The whole item is capped: the right column dictates the height up to
          max-h-96; fields clip with a fade, the button never does. */}
      <div className="grid gap-3 lg:max-h-96 lg:grid-cols-2">
        {/* Document preview — page one rendered whole (object-contain) on a
            soft gray mat; the page count sits top-right. PNGs live next to
            each PDF in public/docs; the <object> viewer is the fallback. */}
        <div className="bg-default/40 relative flex h-full max-h-96 min-h-72 items-center justify-center overflow-hidden rounded-lg border p-1">
          {!isPreviewLoaded && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner aria-label="Loading document preview" size="sm" />
            </span>
          )}
          {previewFailed ? (
            <object
              aria-hidden
              className="pointer-events-none h-full w-full"
              data={`${document.src}#toolbar=0&navpanes=0&scrollbar=0`}
              type="application/pdf"
            />
          ) : (
            <img
              alt=""
              aria-hidden
              className={`pointer-events-none h-full max-h-full w-auto max-w-full rounded-sm bg-white object-contain shadow-sm transition-opacity duration-200 ${
                isPreviewLoaded ? "opacity-100" : "opacity-0"
              }`}
              src={
                // Mock docs have no previewUrl; their PNG sits next to the
                // PDF in public/docs under the same name.
                document.previewUrl ?? document.src?.replace(/\.pdf$/i, ".png")
              }
              onError={() => {
                setPreviewFailed(true);
                setPreviewLoaded(true);
              }}
              onLoad={() => setPreviewLoaded(true)}
            />
          )}
          {pageCount ? (
            <span className="bg-background/80 text-muted absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums backdrop-blur-sm">
              1 of {pageCount}
            </span>
          ) : null}
          <button
            aria-label={`View ${document.name}`}
            className="group absolute inset-0 cursor-pointer"
            type="button"
            onClick={() => setViewerOpen(true)}
          >
            <span className="bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100">
              <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                <IconSquareArrowTopRight className="size-3.5" />
                View document
              </span>
            </span>
          </button>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:max-h-96">
          {document.summary ? (
            <p className="text-muted line-clamp-3 shrink-0 text-xs leading-relaxed">
              {document.summary}
            </p>
          ) : null}
          {/* Fields clip against the item cap; the button below never does. */}
          <div
            ref={fieldsRegionRef}
            className={`bg-background/40 relative min-h-0 flex-1 overflow-hidden rounded-lg border ${
              hiddenFields > 0
                ? "[mask-image:linear-gradient(to_bottom,black_calc(100%-5rem),transparent)]"
                : ""
            }`}
          >
            <div className="flex flex-col gap-0.5 p-3 font-mono text-xs leading-relaxed">
              {lines.map((line) => (
                <div key={line.label} data-field-row>
                  <DocumentLineRow line={line} />
                </div>
              ))}
            </div>
          </div>
          <Button
            className="w-fit shrink-0"
            size="sm"
            variant="secondary"
            onPress={() => setViewerOpen(true)}
          >
            <IconSquareArrowTopRight className="size-3.5" />
            View document
          </Button>
        </div>
      </div>

      <DocumentViewerModal
        document={document}
        isOpen={isViewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}
