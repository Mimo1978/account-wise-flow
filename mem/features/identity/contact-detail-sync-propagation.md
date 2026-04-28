---
name: Contact Detail Sync Propagation
description: Email/phone edits on any person record fan out to every linked Talent/Contact/CRM record and every outreach_target via person_identity_id
type: feature
---
Single source of truth for cross-pool contact updates is the SQL function
`public.sync_person_contact(_person_identity_id, _email, _phone, _update_email, _update_phone)`.

Rules:
- UI MUST call `sync_person_contact` (via supabase.rpc) when editing email/phone on any view that knows the `person_identity_id` — NOT a single-table update.
- DB triggers `trg_fanout_contact_*` on `candidates`, `contacts`, `crm_contacts` AFTER UPDATE OF email, phone automatically fan out to siblings + every `outreach_targets` row sharing the same `person_identity_id`. This guards legacy edit paths that still update a single table.
- All denormalised `outreach_targets.entity_email/entity_phone` columns are kept in sync in real time — past and present campaigns alike.
- Phone values must be normalised through `formatPhoneE164` before being sent (see `mem://features/identity/phone-capture-international`).
- React Query: invalidate `['outreach']`, `['outreach_targets']`, `['candidates']`, `['contacts']`, `['crm_contacts']`, `['person_route']` with `exact: false` after every sync so all open views refresh immediately.

Wired in:
- `src/components/outreach/TargetDetailSheet.tsx` (inline Edit Contact in target queue)

When adding any new "edit phone/email" surface anywhere, prefer the RPC — but the trigger is the safety net.
