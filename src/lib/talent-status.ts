import type { Talent, TalentAvailability, TalentStatus } from "@/lib/types";

export type TalentHeaderStatusKey =
  | "open_to_work"
  | "on_assignment"
  | "not_available"
  | "newly_added"
  | "interviewing"
  | "placed";

export function getTalentAvailabilityFromRow(row: {
  availability_status?: string | null;
  status?: string | null;
}): TalentAvailability {
  if (row.availability_status === "interviewing") return "interviewing";
  if (row.availability_status === "deployed") return "deployed";
  if (row.status === "interviewing") return "interviewing";
  if (row.status === "deployed" || row.status === "on-project") return "deployed";
  return "available";
}

export function getHeaderStatusFromTalent(
  candidate: Pick<Talent, "availability" | "status"> | null | undefined,
): TalentHeaderStatusKey {
  if (!candidate) return "newly_added";
  if (candidate.status === "new") return "newly_added";
  if (candidate.status === "on-hold") return "not_available";
  if (candidate.availability === "interviewing") return "interviewing";
  if (candidate.availability === "deployed") return "on_assignment";
  return "open_to_work";
}

export function getCandidateUpdateFromHeaderStatus(statusKey: TalentHeaderStatusKey): {
  availability_status: TalentAvailability;
  status: TalentStatus;
} {
  switch (statusKey) {
    case "newly_added":
      return { availability_status: "available", status: "new" };
    case "not_available":
      return { availability_status: "deployed", status: "on-hold" };
    case "interviewing":
      return { availability_status: "interviewing", status: "active" };
    case "on_assignment":
    case "placed":
      return { availability_status: "deployed", status: "active" };
    case "open_to_work":
    default:
      return { availability_status: "available", status: "active" };
  }
}