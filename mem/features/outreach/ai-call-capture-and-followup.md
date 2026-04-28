---
name: AI Call Capture & Auto Follow-up
description: Mandatory transcript/note capture on every AI call + auto-trigger of follow-up email when agent commits to send one
type: feature
---
Hardcoded rule: every AI call MUST capture a note + structured outcome on the contact/candidate/target — regardless of transcript length, workspace, or whether the call connected.

Pipeline (`bland-call-webhook`):
1. AI summary tool call now extracts: summary, outcome, sentiment, meeting_agreed, meeting_when/iso, next_step, **notice_period**, **availability**, **email_followup_requested**, **followup_email_topic**, **key_points[]**.
2. Always inserts a note (`candidate_notes` for talent, `notes` with source=`ai_call` for contacts). The full transcript is appended verbatim (or `(no transcript captured by provider)` placeholder).
3. Persists the structured outcome on `outreach_targets`:
   - `last_call_at`, `last_call_outcome`, `last_call_transcript`
   - `last_call_metadata` jsonb (full structured payload)
   - `followup_email_pending` boolean + `followup_email_topic`
4. If `email_followup_requested && entity_email`, fires `trigger-followup-email` (service role).

`trigger-followup-email` edge function:
- Composes a 150-word follow-up email via Lovable AI (`google/gemini-2.5-flash`, tool-calling for subject/plain/html).
- Sends via per-user Resend `integration_settings` key, falls back to global `RESEND_API_KEY`, otherwise saves as draft.
- Always logs `outreach_events` (`email_sent`/`email_drafted`), `crm_activities`, a note on the candidate/contact, and an in-app notification.
- Clears `followup_email_pending=false` on successful send.

DB constraint fix: `notes_source_check` was rejecting `ai_call` — now allows `ai_call`, `ai_email`, `ai_sms` (any new AI-source must be added here too).

UI: `OutreachTargetRow` shows captured chips inline — Notice / Availability / Sentiment / "Sending follow-up…" / Recording link — sourced from `target.last_call_metadata`.
