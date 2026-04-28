import * as React from "react";
import PhoneInputBase, { type Country, isValidPhoneNumber, parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

/**
 * International phone input.
 * - Stores values in E.164 (e.g. +447911123456)
 * - Defaults to United Kingdom (+44)
 * - Searchable country dropdown with flags
 * - Themed to match shadcn `Input` styling
 *
 * IMPORTANT: This is the single source of truth for phone capture across the app.
 * Always use this component instead of a raw <Input> for telephone fields.
 */

export interface PhoneInputProps {
  value: string | undefined;
  onChange: (value: string) => void; // always emits E.164 or "" when empty
  defaultCountry?: Country;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "data-jarvis-id"?: string;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, defaultCountry = "GB", placeholder = "Phone number", disabled, id, className, ...rest }, ref) => {
    return (
      <div className={cn("phone-input-wrapper", className)}>
        <PhoneInputBase
          international
          countryCallingCodeEditable={false}
          defaultCountry={defaultCountry}
          value={value || undefined}
          onChange={(v) => onChange(v ?? "")}
          placeholder={placeholder}
          disabled={disabled}
          id={id}
          numberInputProps={{
            ref: ref as never,
            className:
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            "data-jarvis-id": rest["data-jarvis-id"],
          }}
        />
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export function isValidPhone(value: string | undefined): boolean {
  if (!value) return true; // empty allowed; required handled by caller
  try {
    return isValidPhoneNumber(value);
  } catch {
    return false;
  }
}

export function formatPhoneE164(value: string | undefined, defaultCountry: Country = "GB"): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.startsWith("+")) {
      const p = parsePhoneNumber(trimmed);
      return p?.number ?? trimmed;
    }
    const p = parsePhoneNumber(trimmed, defaultCountry);
    return p?.number ?? trimmed;
  } catch {
    return trimmed;
  }
}