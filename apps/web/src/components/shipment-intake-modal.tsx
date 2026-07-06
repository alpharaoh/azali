import { Button, Chip, Modal, toast } from "@heroui/react";
import { DropZone, Stepper } from "@heroui-pro/react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { DropItem, FileDropItem } from "react-aria-components";

import type { IngestDocumentsDtoFilesItemCategory as DocumentCategory } from "#/generated/api";
import {
  useShipmentDocumentsControllerCreateUploadUrls,
  useShipmentDocumentsControllerIngest,
} from "#/generated/api";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.tiff,.csv,.xls,.xlsx,.doc,.docx,.txt,.eml";

interface DocumentStep {
  id: DocumentCategory;
  title: string;
  stepDescription: string;
  required: boolean;
  /** What the broker should drop here and why it matters. */
  hint: string;
}

const DOCUMENT_STEPS: DocumentStep[] = [
  {
    id: "commercial_invoice",
    title: "Commercial Invoice",
    stepDescription: "The money document",
    required: true,
    hint: "Seller, buyer, product descriptions, quantities, unit prices, currency, and Incoterms. This is the primary source for classification and valuation.",
  },
  {
    id: "packing_list",
    title: "Packing List",
    stepDescription: "Cartons, weights, dimensions",
    required: true,
    hint: "Carton counts, net and gross weights, and dimensions for the shipment.",
  },
  {
    id: "bill_of_lading",
    title: "Bill of Lading / AWB",
    stepDescription: "The transport contract",
    required: true,
    hint: "Ocean bill of lading or air waybill — what's shipping, on what vessel or flight, arriving when and where.",
  },
  {
    id: "arrival_notice",
    title: "Arrival Notice",
    stepDescription: "Carrier inbound notice",
    required: false,
    hint: "From the carrier or forwarder — inbound port, dates, and container or master bill numbers.",
  },
  {
    id: "other",
    title: "Supporting Documents",
    stepDescription: "Certificates, permits, licenses",
    required: false,
    hint: "Certificates of origin for FTA claims, FDA prior notice info, fumigation certificates, licenses or permits — anything product-specific.",
  },
];

const REVIEW_STEP = DOCUMENT_STEPS.length;

const FORMAT_COLORS: Record<
  string,
  "blue" | "gray" | "green" | "orange" | "purple" | "red"
> = {
  CSV: "green",
  DOC: "blue",
  DOCX: "blue",
  EML: "purple",
  JPEG: "blue",
  JPG: "blue",
  PDF: "red",
  PNG: "blue",
  TIFF: "blue",
  XLS: "green",
  XLSX: "green",
};

function fileFormat(name: string) {
  const ext = name.includes(".") ? (name.split(".").pop() ?? "") : "";

  return ext.slice(0, 4).toUpperCase() || "FILE";
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Animates its own height to match the measured content, so step changes
 * (and file list growth) glide instead of snapping the modal size around.
 */
function AnimatedHeight({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      setHeight(element.offsetHeight);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={height === null ? undefined : { height }}
      className={`overflow-hidden ${className ?? ""}`}
      initial={false}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div ref={contentRef} className={contentClassName}>
        {children}
      </div>
    </motion.div>
  );
}

function emptyFileMap(): Record<DocumentCategory, File[]> {
  return {
    arrival_notice: [],
    bill_of_lading: [],
    commercial_invoice: [],
    other: [],
    packing_list: [],
  };
}

export function ShipmentIntakeModal({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createUploadUrls = useShipmentDocumentsControllerCreateUploadUrls();
  const ingestDocuments = useShipmentDocumentsControllerIngest();

  const [step, setStep] = useState(0);
  const [filesByCategory, setFilesByCategory] = useState(emptyFileMap);
  const [isUploading, setIsUploading] = useState(false);

  const totalFiles = DOCUMENT_STEPS.reduce(
    (sum, docStep) => sum + filesByCategory[docStep.id].length,
    0,
  );
  const missingRequired = DOCUMENT_STEPS.filter(
    (docStep) => docStep.required && filesByCategory[docStep.id].length === 0,
  );

  const addFiles = (category: DocumentCategory, added: File[]) => {
    if (added.length === 0) return;
    setFilesByCategory((prev) => ({
      ...prev,
      [category]: [...prev[category], ...added],
    }));
  };

  const removeFile = (category: DocumentCategory, file: File) => {
    setFilesByCategory((prev) => ({
      ...prev,
      [category]: prev[category].filter((existing) => existing !== file),
    }));
  };

  const handleDrop = async (category: DocumentCategory, items: DropItem[]) => {
    const dropped = await Promise.all(
      items
        .filter((item): item is FileDropItem => item.kind === "file")
        .map((item) => item.getFile()),
    );

    addFiles(category, dropped);
  };

  const handleSubmit = () => {
    const entries = DOCUMENT_STEPS.flatMap((docStep) =>
      filesByCategory[docStep.id].map((file) => ({
        category: docStep.id,
        file,
      })),
    );

    if (entries.length === 0) return;

    const run = (async () => {
      const { data } = await createUploadUrls.mutateAsync({
        data: {
          files: entries.map(({ file }) => ({
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          })),
        },
      });

      // Presigned PUTs go straight to S3, so plain fetch — not the API client.
      await Promise.all(
        data.uploads.map(async (upload, index) => {
          const response = await fetch(upload.url, {
            method: "PUT",
            headers: { "Content-Type": upload.contentType },
            body: entries[index].file,
          });

          if (!response.ok) {
            throw new Error(`Upload failed for ${upload.fileName}`);
          }
        }),
      );

      await ingestDocuments.mutateAsync({
        data: {
          files: data.uploads.map((upload, index) => ({
            key: upload.key,
            fileName: upload.fileName,
            contentType: upload.contentType,
            size: entries[index].file.size,
            category: entries[index].category,
          })),
        },
      });
    })();

    setIsUploading(true);
    toast.promise(
      run.finally(() => setIsUploading(false)),
      {
        error: "Document upload failed",
        loading:
          entries.length === 1
            ? "Uploading document..."
            : `Uploading ${entries.length} documents...`,
        success: "Documents uploaded. Shipment process started.",
      },
    );

    run
      .then(() => {
        onOpenChange(false);
        setStep(0);
        setFilesByCategory(emptyFileMap());
      })
      .catch(() => {
        // The toast reports the failure; keep the modal open so nothing is lost.
      });
  };

  const activeDocStep = step < REVIEW_STEP ? DOCUMENT_STEPS[step] : null;

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          {/* Fixed width so the dialog doesn't resize between steps. */}
          <Modal.Dialog className="max-w-full sm:w-3xl">
            <Modal.CloseTrigger />
            {/* The heading lives in the left rail so it shares a top line
                with the step title in the content pane. */}
            <Modal.Body className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex shrink-0 flex-col gap-5 sm:w-56">
                <Modal.Heading className="text-base leading-6 font-semibold">
                  New Shipment Intake
                </Modal.Heading>
                <Stepper
                  currentStep={step}
                  orientation="vertical"
                  onStepChange={setStep}
                >
                  {DOCUMENT_STEPS.map((docStep) => {
                    const count = filesByCategory[docStep.id].length;

                    return (
                      <Stepper.Step key={docStep.id}>
                        <Stepper.Indicator />
                        <Stepper.Content>
                          <Stepper.Title>{docStep.title}</Stepper.Title>
                          <Stepper.Description>
                            {count > 0
                              ? `${count} file${count === 1 ? "" : "s"} added`
                              : docStep.stepDescription}
                          </Stepper.Description>
                        </Stepper.Content>
                        <Stepper.Separator />
                      </Stepper.Step>
                    );
                  })}
                  <Stepper.Step>
                    <Stepper.Indicator />
                    <Stepper.Content>
                      <Stepper.Title>Review</Stepper.Title>
                      <Stepper.Description>
                        Confirm and start intake
                      </Stepper.Description>
                    </Stepper.Content>
                  </Stepper.Step>
                </Stepper>
              </div>

              <AnimatedHeight
                className="min-w-0 flex-1"
                contentClassName="flex flex-col gap-8"
              >
                {activeDocStep ? (
                  <>
                    <div className="flex flex-col gap-1 h-14">
                      <div className="flex items-center gap-2">
                        <h3 className="text-foreground text-base font-semibold">
                          {activeDocStep.title}
                        </h3>
                        {!activeDocStep.required && (
                          <Chip size="sm" variant="soft" color="accent">
                            Optional
                          </Chip>
                        )}
                      </div>
                      <p className="text-muted text-sm">{activeDocStep.hint}</p>
                    </div>
                    <DropZone>
                      <DropZone.Area
                        onDrop={(event) => {
                          void handleDrop(activeDocStep.id, event.items);
                        }}
                      >
                        <DropZone.Icon />
                        <DropZone.Label>
                          Drag and drop files here
                        </DropZone.Label>
                        <DropZone.Description>
                          PDF, images, spreadsheets or emails up to 50 MB
                        </DropZone.Description>
                        <DropZone.Trigger>Browse files</DropZone.Trigger>
                        <DropZone.Input
                          multiple
                          accept={ACCEPT}
                          onSelect={(fileList) =>
                            addFiles(activeDocStep.id, Array.from(fileList))
                          }
                        />
                      </DropZone.Area>
                      {/* Compact one-row items, capped height with a bottom
                          fade once the list scrolls — the modal stays put. */}
                      <DropZone.FileList
                        className={`max-h-40 gap-1 overflow-y-auto ${
                          filesByCategory[activeDocStep.id].length > 4
                            ? "[mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]"
                            : ""
                        }`}
                      >
                        {filesByCategory[activeDocStep.id].map(
                          (file, index) => (
                            <DropZone.FileItem
                              key={`${file.name}-${index}`}
                              className="items-center gap-2 p-1.5"
                            >
                              <DropZone.FileFormatIcon
                                className="h-7 w-[22px]"
                                color={
                                  FORMAT_COLORS[fileFormat(file.name)] ?? "gray"
                                }
                                format={fileFormat(file.name)}
                              />
                              <DropZone.FileInfo className="flex-row items-baseline gap-1.5">
                                <DropZone.FileName className="text-xs">
                                  {file.name}
                                </DropZone.FileName>
                                <DropZone.FileMeta className="shrink-0">
                                  {formatBytes(file.size)}
                                </DropZone.FileMeta>
                              </DropZone.FileInfo>
                              <DropZone.FileRemoveTrigger
                                className="[&_svg]:size-3.5"
                                onPress={() =>
                                  removeFile(activeDocStep.id, file)
                                }
                              />
                            </DropZone.FileItem>
                          ),
                        )}
                      </DropZone.FileList>
                    </DropZone>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-foreground text-base font-semibold">
                        Review
                      </h3>
                      <p className="text-muted text-sm">
                        {totalFiles === 0
                          ? "Add at least one document to start intake."
                          : `${totalFiles} document${totalFiles === 1 ? "" : "s"} ready. Azali will classify, extract, and match them to a client and shipment.`}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {DOCUMENT_STEPS.map((docStep) => {
                        const files = filesByCategory[docStep.id];

                        return (
                          <div
                            key={docStep.id}
                            className="border-border flex flex-col gap-1 rounded-lg border p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-foreground truncate text-sm font-medium">
                                {docStep.title}
                              </span>
                              {files.length > 0 ? (
                                <Chip color="success" size="sm" variant="soft">
                                  {files.length}{" "}
                                  {files.length === 1 ? "file" : "files"}
                                </Chip>
                              ) : docStep.required ? (
                                <Chip color="warning" size="sm" variant="soft">
                                  Missing
                                </Chip>
                              ) : (
                                <Chip size="sm" variant="soft">
                                  Optional
                                </Chip>
                              )}
                            </div>
                            <span className="text-muted truncate text-xs">
                              {files.length > 0
                                ? files.map((file) => file.name).join(", ")
                                : "Nothing uploaded"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {missingRequired.length > 0 && totalFiles > 0 && (
                      <p className="text-muted text-xs">
                        Missing documents won't block intake. Azali flags the
                        gaps and drafts chase emails for whatever hasn't arrived
                        yet.
                      </p>
                    )}
                  </>
                )}
              </AnimatedHeight>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={step === 0 || isUploading}
                variant="outline"
                onPress={() => setStep((current) => Math.max(0, current - 1))}
              >
                Back
              </Button>
              {step < REVIEW_STEP ? (
                <Button
                  variant="primary"
                  onPress={() =>
                    setStep((current) => Math.min(REVIEW_STEP, current + 1))
                  }
                >
                  Continue
                </Button>
              ) : (
                <Button
                  isDisabled={totalFiles === 0}
                  isPending={isUploading}
                  variant="primary"
                  onPress={handleSubmit}
                >
                  Start Intake
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
