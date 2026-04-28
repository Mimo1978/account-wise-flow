---
name: Jarvis Catch-up Briefing
description: "What did I miss?" briefing edge function + Jarvis tool + bell-CTA showing AI calls, follow-up emails, responses, diary, unread alerts
type: feature
---
Edge function `get-catchup-briefing` (verify_jwt=false; user JWT or service-role + body `{workspace_id, since?, user_id?}`).
Returns `headline`, `counts.{calls_completed, meetings_booked, followup_emails_pending, followup_emails_sent, responses_awaiting, diary_next_24h, diary_next_7d, unread_notifications}`, and `details`.
Default window = last 24h.

Jarvis tool `get_catchup_briefing` (in `jarvis-assistant/index.ts`) — triggers on "what did I miss", "catch me up", "what's new", "give me a summary". Calls the function with resolved teamId + userId.

UI — `NotificationBell` "✨ Catch me up" button renders a 2-col grid of non-zero counts above the notification list.

Sources: `outreach_targets.last_call_metadata/followup_email_pending` (populated by `bland-call-webhook`), `outreach_events` filtered by `metadata @> {source: ai_call_followup}` (use `email_sent` — `email_drafted` is NOT in the enum), `outreach_targets.state='responded'`, `diary_events`, `notifications`.
