import { z } from 'zod';

/**
 * JSON overlay schema. Overlays are *multipliers* over a TS primitive:
 * the recorder takes one factory (`walk`), one matrix of args, and stamps out
 * N concrete `SimulationSequence`s wrapped in `testCase` brackets.
 *
 * Schema is intentionally simple — the heavy ergonomics live in the TS DSL.
 */

export const matrixDimSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('range'),
    from: z.number(),
    to: z.number(),
    step: z.number().positive(),
  }),
  z.object({
    kind: z.literal('list'),
    values: z.array(z.union([z.number(), z.string(), z.boolean()])).min(1),
  }),
  z.object({
    kind: z.literal('const'),
    value: z.union([z.number(), z.string(), z.boolean()]),
  }),
]);

export const overlayCallSchema = z.object({
  primitive: z.string(),
  args: z.record(z.unknown()).optional(),
});

export const overlaySchema = z.object({
  $schema: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  primitive: z.string().min(1),
  setup: z.array(overlayCallSchema).optional(),
  teardown: z.array(overlayCallSchema).optional(),
  matrix: z.record(matrixDimSchema),
  skip: z.array(z.record(z.unknown())).optional(),
});

export type Overlay = z.infer<typeof overlaySchema>;
export type MatrixDim = z.infer<typeof matrixDimSchema>;
export type OverlayCall = z.infer<typeof overlayCallSchema>;

export function parseOverlay(input: unknown): Overlay {
  return overlaySchema.parse(input);
}
