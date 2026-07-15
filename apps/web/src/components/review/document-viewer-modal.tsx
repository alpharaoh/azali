import { ArrowUpRightFromSquare } from "@gravity-ui/icons";
import { Modal, Spinner } from "@heroui/react";
import { useState } from "react";
import { receivedAgo } from "#/components/review/timeline-items";
import type { DocumentLine, ReviewDocument } from "#/lib/review-types";

export function DocumentLineRow({ line }: { line: DocumentLine }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 rounded px-1.5 py-0.5 ${
        line.highlight ? "bg-warning/15" : ""
      }`}
    >
      <span className="text-muted shrink-0">{line.label}</span>
      <span
        className={`text-right ${
          line.highlight ? "text-foreground font-semibold" : "text-foreground"
        }`}
      >
        {line.value}
      </span>
    </div>
  );
}

/**
 * The full document viewer: the real PDF at reading size on the left, the
 * complete AI reading (summary + every extracted field) on the right.
 */
export function DocumentViewerModal({
  document,
  isOpen,
  onOpenChange,
}: {
  document: ReviewDocument & { kind: "pdf"; src?: string };
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isLoaded, setLoaded] = useState(false);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-w-full sm:w-[95vw]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{document.name}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="min-h-0">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="relative h-[78dvh] w-full overflow-hidden rounded-lg border bg-white">
                  {!isLoaded && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Spinner aria-label="Loading document" size="sm" />
                    </span>
                  )}
                  <object
                    aria-label={document.name}
                    className={`h-full w-full transition-opacity duration-200 ${
                      isLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    data={`${document.src}#view=FitH`}
                    type="application/pdf"
                    onLoad={() => setLoaded(true)}
                  >
                    <div className="flex h-full items-center justify-center">
                      <a
                        className="text-accent text-xs underline-offset-2 hover:underline"
                        href={document.src}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open {document.name}
                      </a>
                    </div>
                  </object>
                </div>

                <div className="flex min-w-0 flex-col gap-3 lg:h-[78dvh] lg:overflow-y-auto lg:pr-1">
                  <span className="text-muted text-xs">
                    {document.meta} · received{" "}
                    {receivedAgo(document.receivedHoursAgo)}
                  </span>
                  {document.summary ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-muted text-xs font-medium">
                        AI summary
                      </span>
                      <p className="text-foreground text-sm leading-relaxed">
                        {document.summary}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <span className="text-muted text-xs font-medium">
                      Extracted fields ({document.lines.length})
                    </span>
                    <div className="bg-background/40 flex flex-col gap-0.5 rounded-lg border p-3 font-mono text-xs leading-relaxed">
                      {document.lines.map((line) => (
                        <DocumentLineRow key={line.label} line={line} />
                      ))}
                    </div>
                  </div>
                  <a
                    className="text-muted hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors"
                    href={document.src}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ArrowUpRightFromSquare className="size-3" />
                    Open original in a new tab
                  </a>
                </div>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
