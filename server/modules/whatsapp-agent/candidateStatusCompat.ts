const LEGACY_PENDING_REVIEW_STATUS = "pending_review";
const LEGACY_CONFIRMED_STATUS = "confirmed";
const LEGACY_IGNORED_STATUS = "ignored";

export function mapLogicalCandidateStatusToPersisted(status: string) {
  switch (status) {
    case "awaiting_user_confirmation":
    case "awaiting_account_selection":
    case "needs_clarification":
      return LEGACY_PENDING_REVIEW_STATUS;
    case "auto_created_pending_review":
    case "reviewed_confirmed":
    case "reviewed_corrected":
    case "confirmed":
      return LEGACY_CONFIRMED_STATUS;
    case "reviewed_removed":
    case "ignored_pattern":
    case "ignored":
      return LEGACY_IGNORED_STATUS;
    default:
      return status;
  }
}

export function resolveLogicalCandidateStatus(row: any) {
  const evidenceStatus = row?.evidence?.reviewStatus;
  if (typeof evidenceStatus === "string" && evidenceStatus.trim()) {
    return evidenceStatus;
  }
  return row?.status || LEGACY_PENDING_REVIEW_STATUS;
}

export function normalizeCandidateRow(row: any) {
  if (!row) return row;
  return {
    ...row,
    status: resolveLogicalCandidateStatus(row),
  };
}

export function mapLogicalStatusesForQuery(statuses: string[]) {
  const mapped = statuses.flatMap((status) => {
    switch (status) {
      case "awaiting_user_confirmation":
      case "awaiting_account_selection":
      case "needs_clarification":
        return [LEGACY_PENDING_REVIEW_STATUS];
      case "auto_created_pending_review":
      case "reviewed_confirmed":
      case "reviewed_corrected":
      case "confirmed":
        return [LEGACY_CONFIRMED_STATUS];
      case "reviewed_removed":
      case "ignored_pattern":
      case "ignored":
        return [LEGACY_IGNORED_STATUS];
      default:
        return [status];
    }
  });

  return Array.from(new Set(mapped));
}

export const candidateStatusCompat = {
  mapLogicalCandidateStatusToPersisted,
  mapLogicalStatusesForQuery,
  normalizeCandidateRow,
  resolveLogicalCandidateStatus,
};
