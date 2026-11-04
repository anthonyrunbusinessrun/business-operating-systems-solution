import type { AttachmentValue, Choice, ChoiceColor, FieldDef, FieldOptions, FieldType } from "./types";
import { CHOICE_COLORS } from "./types";

/** Chip colors of select fields. The values come from the active theme (`--tone-*` tokens), so chips stay readable in every skin. */
export const CHOICE_TONES: Record<ChoiceColor, { bg: string; fg: string; border: string }> = {
  blue: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)", border: "var(--tone-blue-border)" },
  cyan: { bg: "var(--tone-cyan-bg)", fg: "var(--tone-cyan-fg)", border: "var(--tone-cyan-border)" },
  green: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)", border: "var(--tone-green-border)" },
  yellow: { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow-fg)", border: "var(--tone-yellow-border)" },
  orange: { bg: "var(--tone-orange-bg)", fg: "var(--tone-orange-fg)", border: "var(--tone-orange-border)" },
  red: { bg: "var(--tone-red-bg)", fg: "var(--tone-red-fg)", border: "var(--tone-red-border)" },
  pink: { bg: "var(--tone-pink-bg)", fg: "var(--tone-pink-fg)", border: "var(--tone-pink-border)" },
  purple: { bg: "var(--tone-purple-bg)", fg: "var(--tone-purple-fg)", border: "var(--tone-purple-border)" },
  gray: { bg: "var(--tone-gray-bg)", fg: "var(--tone-gray-fg)", border: "var(--tone-gray-border)" },
};

export interface FieldTypeInfo {
  type: FieldType;
  label: string;
  description: string;
  /** Creatable from the "Add field" menu. */
  creatable: boolean;
  /** Value can be edited by a person (computed and autonumber cannot). */
  editable: boolean;
}

export const FIELD_TYPE_INFO: FieldTypeInfo[] = [
  { type: "text", label: "Single line text", description: "A short piece of text", creatable: true, editable: true },
  { type: "longText", label: "Long text", description: "Notes and descriptions over several lines", creatable: true, editable: true },
  { type: "number", label: "Number", description: "Whole numbers, decimals, currency or percent", creatable: true, editable: true },
  { type: "date", label: "Date", description: "A calendar date", creatable: true, editable: true },
  { type: "checkbox", label: "Checkbox", description: "Yes / no", creatable: true, editable: true },
  { type: "singleSelect", label: "Single select", description: "Pick one option", creatable: true, editable: true },
  { type: "multiSelect", label: "Multiple select", description: "Pick several options", creatable: true, editable: true },
  { type: "attachment", label: "Attachment", description: "Images and files", creatable: true, editable: true },
  { type: "url", label: "URL", description: "A web address", creatable: true, editable: true },
  { type: "email", label: "Email", description: "An email address", creatable: true, editable: true },
  { type: "phone", label: "Phone", description: "A phone number", creatable: true, editable: true },
  { type: "link", label: "Link to another record", description: "Connect records from another table", creatable: true, editable: true },
  { type: "autonumber", label: "Autonumber", description: "A number assigned automatically", creatable: false, editable: false },
  { type: "computed", label: "Computed", description: "Calculated from other fields", creatable: false, editable: false },
];

export const fieldTypeLabel = (type: FieldType) => FIELD_TYPE_INFO.find((t) => t.type === type)?.label ?? type;
export const isEditableType = (type: FieldType) => FIELD_TYPE_INFO.find((t) => t.type === type)?.editable ?? true;

/**
 * Whether a person can type into the field in the generic record form or a grid cell.
 * Generated sequence codes, computed fields and autonumbers never can.
 */
export function isUserEditable(field: FieldDef, _mode: "create" | "update"): boolean {
  return isEditableType(field.type) && !field.options.sequence;
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14).padEnd(12, "0");
  return `${prefix}_${rand}`;
}

export const newFieldKey = () => newId("fld");

/** Build a choice list from plain names, cycling through the palette. */
export function choicesFromNames(names: readonly string[], colors?: readonly ChoiceColor[]): Choice[] {
  return names.map((name, i) => ({
    id: `ch_${slug(name) || i}`,
    name,
    color: colors?.[i] ?? CHOICE_COLORS[i % CHOICE_COLORS.length],
  }));
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function defaultOptions(type: FieldType): FieldOptions {
  switch (type) {
    case "number":
      return { format: "integer", precision: 0 };
    case "singleSelect":
    case "multiSelect":
      return { choices: [] };
    case "attachment":
      return {};
    case "link":
      return { multiple: false };
    default:
      return {};
  }
}

export function choiceByName(field: FieldDef, name: unknown): Choice | undefined {
  if (typeof name !== "string") return undefined;
  return field.options.choices?.find((c) => c.name === name);
}

/** Colour for a value that is not one of the configured choices (free tags). */
export function fallbackColor(name: string): ChoiceColor {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CHOICE_COLORS[h % CHOICE_COLORS.length];
}

/** Attachments are stored as arrays; older records hold a bare URL string. Both read the same. */
export function readAttachments(value: unknown): AttachmentValue[] {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") {
    const name = value.split("/").pop() || value;
    return [{ id: "", name, url: value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((v): AttachmentValue[] => {
      if (typeof v === "string") return readAttachments(v);
      if (v && typeof v === "object" && typeof (v as AttachmentValue).url === "string") {
        const a = v as AttachmentValue;
        return [{ id: a.id ?? "", name: a.name ?? a.url, url: a.url, type: a.type, size: a.size }];
      }
      return [];
    });
  }
  return [];
}

export const isImageAttachment = (a: AttachmentValue) => (a.type ? a.type.startsWith("image/") : /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(a.url) || /\.(png|jpe?g|gif|webp|avif)$/i.test(a.name));

export function fieldByKey(fields: FieldDef[]): Map<string, FieldDef> {
  return new Map(fields.map((f) => [f.key, f]));
}

export function primaryField(fields: FieldDef[]): FieldDef | undefined {
  return fields.find((f) => f.primary) ?? fields[0];
}
