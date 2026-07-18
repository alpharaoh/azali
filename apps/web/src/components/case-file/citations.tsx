import { IconSquareArrowTopRight } from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Chip } from "@heroui/react";
import { ChatSource, HoverCard } from "@heroui-pro/react";
import type {
  Citation,
  CitationKind,
  ReviewDocument,
  ReviewItem,
} from "#/lib/review-types";

const citationMeta: Record<
  CitationKind,
  { chip: "accent" | "default" | "success" | "warning"; label: string }
> = {
  catalog: { chip: "success", label: "Catalog" },
  evidence: { chip: "warning", label: "Evidence" },
  regulation: { chip: "default", label: "Regulation" },
  ruling: { chip: "accent", label: "CROSS Ruling" },
};

export function faviconFor(href: string) {
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(href)}&sz=64`;
}

/** The hover body shared by both pill variants — kind, reference, exact passage. */
function CitationQuote({ citation }: { citation: Citation }) {
  const meta = citationMeta[citation.kind];

  return (
    <div className="flex max-w-72 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Chip color={meta.chip} size="sm" variant="soft">
          <Chip.Label>{meta.label}</Chip.Label>
        </Chip>
        <span className="text-foreground font-mono text-xs font-semibold">
          {citation.ref}
        </span>
      </div>
      <p className="text-muted m-0 text-xs leading-relaxed">
        “{citation.quote}”
      </p>
    </div>
  );
}

/**
 * The top half of the cited document inside the hover card — the real scan for
 * scans, a reconstructed sheet for PDFs. Hovering fades in "View full document",
 * which opens the file in a new tab.
 */
function DocPeek({ document: doc }: { document: ReviewDocument }) {
  if (doc.kind === "email") return null;

  const href = doc.src;

  return (
    <a
      className="group relative block h-28 overflow-hidden border-b"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {doc.kind === "scan" ? (
        <img
          alt={doc.name}
          className="h-full w-full object-cover object-top"
          src={doc.src}
        />
      ) : (
        <div className="bg-surface flex h-full flex-col gap-1 px-3.5 py-3">
          <span className="text-foreground text-[11px] font-semibold leading-tight">
            {doc.name}
          </span>
          <span className="text-muted text-[9px]">{doc.meta}</span>
          <div className="bg-separator my-0.5 h-px" />
          {doc.lines.slice(0, 4).map((line) => (
            <div
              key={line.label}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="text-muted shrink-0 text-[9px]">
                {line.label}
              </span>
              <span className="text-foreground truncate text-[9px] font-medium">
                {line.value}
              </span>
            </div>
          ))}
        </div>
      )}
      <span className="bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100">
        <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
          <IconSquareArrowTopRight className="size-3.5" />
          View full document
        </span>
      </span>
    </a>
  );
}

/** Resolve the document a citation points at, for the hover preview. */
export function findCitedDocument(item: ReviewItem, citation: Citation) {
  if (!citation.documentName) return undefined;

  return item.documents.find(
    (doc) => doc.kind !== "email" && doc.name === citation.documentName,
  );
}

/**
 * Compact source pill — hover reveals the exact passage the agent relied on.
 * External sources (rulings, eCFR, HTSUS) get a favicon and open the real page;
 * internal evidence renders as a document pill with a peek at the document.
 */
export function CitationPill({
  citation,
  document,
}: {
  citation: Citation;
  document?: ReviewDocument;
}) {
  if (citation.href) {
    return (
      <ChatSource enablePreview className="self-start" href={citation.href}>
        <ChatSource.Trigger>
          <ChatSource.Icon faviconUrl={faviconFor(citation.href)} />
          <ChatSource.Title>{citation.ref}</ChatSource.Title>
        </ChatSource.Trigger>
        <ChatSource.Preview className="p-3">
          <CitationQuote citation={citation} />
        </ChatSource.Preview>
      </ChatSource>
    );
  }

  return (
    <HoverCard closeDelay={100} openDelay={150}>
      <HoverCard.Trigger className="inline-flex w-fit max-w-full self-start">
        <ChatSource sourceType="document" title={citation.ref} />
      </HoverCard.Trigger>
      <HoverCard.Content
        className={document ? "w-72 overflow-hidden p-0" : "p-3"}
        placement="top"
      >
        {document ? <DocPeek document={document} /> : null}
        <div className={document ? "p-3" : undefined}>
          <CitationQuote citation={citation} />
        </div>
      </HoverCard.Content>
    </HoverCard>
  );
}
