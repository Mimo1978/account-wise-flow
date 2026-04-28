import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// New tables aren't in generated types yet — cast to any for them
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Canonical resolution of a person across the three contact pools:
 * - candidates (Talent)
 * - contacts   (canonical Contacts DB)
 * - crm_contacts (CRM-only contacts)
 *
 * Backed by the SQL function `public.resolve_person_route(person_identity_id)`
 * created in the Person Identity Unification migration. Priority used:
 * Talent → Contact → CRM Contact.
 */
export interface ResolvedPerson {
  person_identity_id: string;
  candidate_id: string | null;
  contact_id: string | null;
  crm_contact_id: string | null;
  preferred_route: "talent" | "contact" | "crm_contact" | "none";
  display_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
}

/**
 * Resolve which profile pages exist for a given person identity.
 * Use this instead of guessing from a stale entity_type column.
 */
export function usePersonRoute(personIdentityId?: string | null) {
  return useQuery({
    queryKey: ["person_route", personIdentityId],
    enabled: !!personIdentityId,
    queryFn: async (): Promise<ResolvedPerson | null> => {
      const { data, error } = await db.rpc("resolve_person_route", {
        _person_identity_id: personIdentityId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
    staleTime: 60_000,
  });
}

/**
 * Reverse lookup: given any of the three source ids, return the identity id.
 * Useful when upgrading legacy code paths that only carry one id.
 */
export async function findPersonIdentityBySource(args: {
  candidate_id?: string | null;
  contact_id?: string | null;
  crm_contact_id?: string | null;
}): Promise<string | null> {
  const { data, error } = await db.rpc("find_person_identity_by_source", {
    _candidate_id: args.candidate_id ?? null,
    _contact_id: args.contact_id ?? null,
    _crm_contact_id: args.crm_contact_id ?? null,
  });
  if (error) {
    console.warn("[findPersonIdentityBySource] failed", error);
    return null;
  }
  return (data as string | null) ?? null;
}

/**
 * Build the canonical profile URL for a resolved person, honouring the
 * Talent → Contact → CRM Contact priority. Returns `null` if no profile
 * exists for any source (caller should show a friendly empty state).
 */
export function buildPersonProfileUrl(p: ResolvedPerson | null | undefined): {
  url: string | null;
  label: string;
  source: ResolvedPerson["preferred_route"];
} {
  if (!p || p.preferred_route === "none") {
    return { url: null, label: "No linked profile", source: "none" };
  }
  switch (p.preferred_route) {
    case "talent":
      return p.candidate_id
        ? { url: `/talent/${p.candidate_id}`, label: "Open Talent Profile", source: "talent" }
        : { url: null, label: "No linked profile", source: "none" };
    case "contact":
      return p.contact_id
        ? { url: `/contacts/${p.contact_id}`, label: "Open Contact Profile", source: "contact" }
        : { url: null, label: "No linked profile", source: "none" };
    case "crm_contact":
      return p.crm_contact_id
        ? { url: `/crm/contacts/${p.crm_contact_id}`, label: "Open CRM Contact", source: "crm_contact" }
        : { url: null, label: "No linked profile", source: "none" };
    default:
      return { url: null, label: "No linked profile", source: "none" };
  }
}
