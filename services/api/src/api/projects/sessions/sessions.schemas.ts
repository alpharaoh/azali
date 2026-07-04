import { z } from "zod";

export const RunFormattingSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  sizePt: z.number().optional(),
  fontFace: z.string().optional(),
  color: z.string().optional(),
  colorType: z.string(),
  schemeColor: z.string().optional(),
  baseline: z.number(),
});

export const ExtractedRunSchema = z.object({
  ref: z.object({ index: z.number() }),
  text: z.string(),
  formatting: RunFormattingSchema,
});

export const ExtractedParagraphSchema = z.object({
  ref: z.object({ index: z.number() }),
  skip: z.boolean(),
  skipReason: z.string().optional(),
  paragraphFormatting: z.object({
    alignment: z.string().optional(),
    level: z.number(),
    spaceBefore: z.number(),
    spaceAfter: z.number(),
  }),
  runs: z.array(ExtractedRunSchema),
});

export const ExtractedShapeSchema = z.object({
  ref: z.object({
    slide: z.object({
      slideDeckId: z.number(),
      relationshipId: z.string(),
      partUri: z.string(),
    }),
    shapeId: z.number(),
    groupPath: z.array(z.number()),
  }),
  shapeName: z.string(),
  shapeType: z.string(),
  skip: z.boolean(),
  skipReason: z.string().optional(),
  geometry: z.object({
    x: z.number(),
    y: z.number(),
    cx: z.number(),
    cy: z.number(),
    zOrder: z.number(),
  }),
  placeholder: z
    .object({ type: z.string(), idx: z.number().optional() })
    .optional(),
  groupId: z.number().optional(),
  paragraphs: z.array(ExtractedParagraphSchema).optional(),
  tableData: z
    .object({
      rowCount: z.number(),
      colCount: z.number(),
      cells: z.array(
        z.object({
          row: z.number(),
          col: z.number(),
          paragraphs: z.array(ExtractedParagraphSchema),
        }),
      ),
    })
    .optional(),
});

export const GradientStopSchema = z.object({
  color: z.string(),
  position: z.number(),
});

export const SlideBackgroundSchema = z.object({
  type: z.string(),
  color: z.string().optional(),
  angle: z.number().optional(),
  stops: z.array(GradientStopSchema).optional(),
  imageRelId: z.string().optional(),
});

export const ExtractedSlideSchema = z.object({
  ref: z.object({
    slideDeckId: z.number(),
    relationshipId: z.string(),
    partUri: z.string(),
  }),
  displayIndex: z.number(),
  background: SlideBackgroundSchema,
  shapes: z.array(ExtractedShapeSchema),
});

export const StructureSchema = z.object({
  sessionId: z.string(),
  slideCount: z.number(),
  slideWidth: z.number(),
  slideHeight: z.number(),
  slides: z.array(ExtractedSlideSchema),
});

export const PptxOperationSchema = z.looseObject({
  $type: z.string(),
});
