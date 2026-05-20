import type { MatrixDim, Overlay } from './schema.js';
import { primitives } from '../primitives/index.js';
import { SimulationBuilder, type SimulationSequence } from '../builder.js';

/** Materialize a matrix dim into a concrete list of values. */
export function expandDim(dim: MatrixDim): readonly (number | string | boolean)[] {
  if (dim.kind === 'const') return [dim.value];
  if (dim.kind === 'list') return dim.values;
  // range
  const out: number[] = [];
  if (dim.step <= 0) throw new Error('range step must be positive');
  // Inclusive of `from`; "to" is treated as exclusive only when from < to and the
  // last value would overshoot. We add a tiny epsilon to handle float drift on
  // step counts like 0.1.
  const eps = dim.step * 1e-9;
  if (dim.from <= dim.to) {
    for (let v = dim.from; v <= dim.to + eps; v += dim.step) out.push(round(v));
  } else {
    for (let v = dim.from; v >= dim.to - eps; v -= dim.step) out.push(round(v));
  }
  return out;
}

function round(v: number): number {
  // Trim float drift introduced by repeated addition. 6 decimal places is plenty
  // for yaw/pitch grids; downstream serialization isn't sensitive past that.
  return Math.round(v * 1e6) / 1e6;
}

/** Cartesian product of named dims; preserves key order for predictable case names. */
export function cartesian(
  matrix: Record<string, MatrixDim>,
): { args: Record<string, number | string | boolean> }[] {
  const keys = Object.keys(matrix);
  if (keys.length === 0) return [{ args: {} }];

  let acc: Record<string, number | string | boolean>[] = [{}];
  for (const key of keys) {
    const dim = matrix[key];
    if (!dim) continue;
    const values = expandDim(dim);
    const next: Record<string, number | string | boolean>[] = [];
    for (const partial of acc) {
      for (const v of values) {
        next.push({ ...partial, [key]: v });
      }
    }
    acc = next;
  }
  return acc.map((args) => ({ args }));
}

function caseNameFor(prefix: string, args: Record<string, unknown>): string {
  const parts = Object.entries(args).map(([k, v]) => `${k}=${formatValue(v)}`);
  return parts.length === 0 ? prefix : `${prefix}__${parts.join('_')}`;
}

function formatValue(v: unknown): string {
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
  }
  return String(v);
}

function shouldSkip(
  args: Record<string, unknown>,
  skip?: Array<Record<string, unknown>>,
): boolean {
  if (!skip) return false;
  return skip.some((entry) =>
    Object.entries(entry).every(([k, v]) => args[k] === v),
  );
}

/**
 * Expand an overlay JSON into one runnable `SimulationSequence` that contains
 * all matrix cases (each wrapped in a `testCase` block) plus optional setup/teardown.
 */
export function expandOverlay(overlay: Overlay): SimulationSequence {
  const factory = primitives[overlay.primitive as keyof typeof primitives];
  if (!factory) {
    throw new Error(
      `Unknown primitive '${overlay.primitive}'. Known: ${Object.keys(primitives).join(', ')}`,
    );
  }

  const builder = new SimulationBuilder();

  for (const setup of overlay.setup ?? []) {
    const f = primitives[setup.primitive as keyof typeof primitives];
    if (!f) throw new Error(`Unknown setup primitive '${setup.primitive}'`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    builder.include((f as any)(setup.args ?? {}));
  }

  for (const { args } of cartesian(overlay.matrix)) {
    if (shouldSkip(args, overlay.skip)) continue;
    const name = caseNameFor(overlay.name, args);
    builder.testCase(name, (b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inner = (factory as any)(args) as SimulationBuilder;
      return b.include(inner);
    });
  }

  for (const teardown of overlay.teardown ?? []) {
    const f = primitives[teardown.primitive as keyof typeof primitives];
    if (!f) throw new Error(`Unknown teardown primitive '${teardown.primitive}'`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    builder.include((f as any)(teardown.args ?? {}));
  }

  return builder.build();
}
