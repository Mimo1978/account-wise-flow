---
name: International Phone Capture
description: All phone fields use shared PhoneInput (E.164, default GB +44) with searchable country dropdown
type: feature
---
Single source of truth for phone capture is `src/components/ui/phone-input.tsx` (`PhoneInput`).

Rules:
- Every telephone/mobile entry point in the app MUST use `<PhoneInput>` — never a raw `<Input>`.
- Stores values in **E.164** (e.g. `+447911123456`) so the AI dialer, Twilio, SMS, and integrations can route correctly.
- Default country: **GB (United Kingdom, +44)**. Searchable flag dropdown for other regions.
- Built on `react-phone-number-input` + `libphonenumber-js`.
- Themed in `index.css` under `.phone-input-wrapper` to match shadcn dark UI.

Wired into:
- CRM: `AddEditContactPanel` (phone + mobile), `AddEditCompanyPanel`
- Talent: `CandidateEditForm`, `AddCandidateModal`
- Contacts: `EditContactModal`, canvas `AddContactModal`, canvas `PhoneInlineEditor`
- Leads: `AddLeadModal`
- Jobs: `PostJobForm` (board contact phone)
- Imports: `EntityEditForm` (personal + crm sections)

Backfill (one-shot, completed 2026-04-28): existing rows in `contacts.phone`, `crm_contacts.phone`, `crm_contacts.mobile`, `candidates.phone` without a `+` prefix were normalised to `+44...` (leading `0` stripped). Numbers <7 digits left untouched as junk.

When adding any new phone field anywhere in the app, import from `@/components/ui/phone-input` — do not introduce raw text inputs for phones.