// Carousel 2.0 · runtime validation for parsed catalog products (zod).
// Keeps the parser honest: a product that fails validation is dropped with a
// reason rather than corrupting the library. Mirrors ./types.ts.

import { z } from "zod";
import type { CatalogProduct, CatalogManifest } from "./types";

const dims = z.object({ width: z.number().positive(), height: z.number().positive() });

const fieldType = z.enum(["text", "richtext", "image", "chart", "number", "color"]);
const fieldRole = z
  .enum([
    "headline",
    "subhead",
    "body",
    "eyebrow",
    "stat",
    "label",
    "quote",
    "attribution",
    "image",
    "logo",
    "chart",
    "footer",
    "page-number",
  ])
  .optional();

const constraints = z
  .object({
    maxLen: z.number().optional(),
    minFont: z.number().optional(),
    maxFont: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    required: z.boolean().optional(),
    multiline: z.boolean().optional(),
    options: z.array(z.string()).optional(),
  })
  .optional();

const locator = z.object({
  svgId: z.string().optional(),
  dataField: z.string().optional(),
  objectIndex: z.number().int().nonnegative().optional(),
  role: fieldRole,
});

const field = z.object({
  name: z.string().min(1),
  type: fieldType,
  label: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  constraints,
  locator,
});

const source = z.object({ file: z.string().min(1), contentHash: z.string().optional() });

const base = {
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string(),
  tags: z.array(z.string()),
  dims,
  source,
  svg: z.string().min(1),
  thumb: z.string().optional(),
  fields: z.array(field),
  schemaVersion: z.number().int(),
  createdAt: z.number(),
  updatedAt: z.number(),
  meta: z.record(z.string(), z.unknown()).optional(),
};

const backgroundSchema = z.object({ ...base, kind: z.literal("background") });

const moduleSchema = z.object({
  ...base,
  kind: z.literal("module"),
  moduleType: z.enum(["chart", "text-box", "stat", "quote", "logo-lockup", "element"]),
  anchor: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .optional(),
});

const compositionRef = z.object({
  ref: z.string(),
  refKind: z.enum(["background", "module"]),
  placement: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), z: z.number().optional() })
    .optional(),
  fieldOverrides: z.record(z.string(), z.unknown()).optional(),
});

const templateSchema = z.object({
  ...base,
  kind: z.literal("template"),
  composition: z.array(compositionRef).optional(),
  coverEligible: z.boolean().optional(),
});

export const productSchema = z.discriminatedUnion("kind", [
  backgroundSchema,
  moduleSchema,
  templateSchema,
]);

export const manifestSchema = z.object({
  version: z.number().int(),
  files: z.array(
    z.object({
      path: z.string().min(1),
      kind: z.enum(["background", "template", "module"]).optional(),
      id: z.string().optional(),
    })
  ),
});

export type ValidateResult =
  | { ok: true; product: CatalogProduct }
  | { ok: false; errors: string[] };

export function validateProduct(input: unknown): ValidateResult {
  const parsed = productSchema.safeParse(input);
  if (parsed.success) {
    // Field names must be unique within a product (locators resolve by name).
    const names = parsed.data.fields.map((f) => f.name);
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) return { ok: false, errors: [`duplicate field name: ${dup}`] };
    return { ok: true, product: parsed.data as CatalogProduct };
  }
  return { ok: false, errors: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`) };
}

export function validateManifest(input: unknown): CatalogManifest | null {
  const parsed = manifestSchema.safeParse(input);
  return parsed.success ? (parsed.data as CatalogManifest) : null;
}
