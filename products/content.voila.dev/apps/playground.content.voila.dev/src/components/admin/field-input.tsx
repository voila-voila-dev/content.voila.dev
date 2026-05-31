// VENDED by @voila/content-registry — you own this file.
// The write-side inverse of `field-value.tsx`: one input control per field kind,
// chosen from the field's `@voila/content` metadata. Values are held in their
// *encoded* form (the wire shape the server decodes) — strings, numbers, booleans,
// epoch-ms for datetime — so the parent form's record submits straight through.
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { fieldMetaFor } from "~/lib/admin";

type SelectOption = string | { readonly label?: string; readonly value: string };

const asText = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

export function FieldInput({
  slug,
  name,
  value,
  onChange,
  disabled,
}: {
  readonly slug: string;
  readonly name: string;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
  readonly disabled?: boolean;
}) {
  const meta = fieldMetaFor(slug, name);
  const kind = meta?.widget ?? meta?.kind ?? "string";
  const id = `field-${name}`;

  if (kind === "boolean") {
    return (
      <Checkbox
        id={id}
        disabled={disabled}
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (kind === "number") {
    return (
      <Input
        id={id}
        type="number"
        disabled={disabled}
        value={asText(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)}
      />
    );
  }

  if (kind === "select" && Array.isArray(meta?.options)) {
    const options = meta.options as ReadonlyArray<SelectOption>;
    return (
      <Select
        id={id}
        disabled={disabled}
        value={asText(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      >
        <option value="">Select…</option>
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const label = typeof option === "string" ? option : (option.label ?? option.value);
          return (
            <option key={optionValue} value={optionValue}>
              {label}
            </option>
          );
        })}
      </Select>
    );
  }

  if (kind === "datetime") {
    // `datetime` stores epoch-ms (the field's encoded form), so convert both ways.
    const local = typeof value === "number" ? new Date(value).toISOString().slice(0, 16) : "";
    return (
      <Input
        id={id}
        type="datetime-local"
        disabled={disabled}
        value={local}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : new Date(e.target.value).getTime())
        }
      />
    );
  }

  if (kind === "date") {
    return (
      <Input
        id={id}
        type="date"
        disabled={disabled}
        value={asText(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      />
    );
  }

  if (kind === "markdown" || kind === "json" || kind === "code") {
    return (
      <Textarea
        id={id}
        disabled={disabled}
        value={asText(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      />
    );
  }

  // string / slug / anything else → a plain text input.
  return (
    <Input
      id={id}
      disabled={disabled}
      value={asText(value)}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
    />
  );
}
