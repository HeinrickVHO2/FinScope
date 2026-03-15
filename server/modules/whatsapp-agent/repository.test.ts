import test from "node:test";
import assert from "node:assert/strict";
import { candidateStatusCompat } from "./candidateStatusCompat";

test("candidate status compatibility maps logical statuses to persisted legacy values", () => {
  assert.equal(
    candidateStatusCompat.mapLogicalCandidateStatusToPersisted("awaiting_user_confirmation"),
    "pending_review",
  );
  assert.equal(
    candidateStatusCompat.mapLogicalCandidateStatusToPersisted("needs_clarification"),
    "pending_review",
  );
  assert.equal(
    candidateStatusCompat.mapLogicalCandidateStatusToPersisted("auto_created_pending_review"),
    "confirmed",
  );
  assert.equal(
    candidateStatusCompat.mapLogicalCandidateStatusToPersisted("reviewed_removed"),
    "ignored",
  );
});

test("candidate status compatibility restores logical status from evidence reviewStatus", () => {
  const normalized = candidateStatusCompat.normalizeCandidateRow({
    id: "candidate-1",
    status: "pending_review",
    evidence: {
      reviewStatus: "awaiting_account_selection",
    },
  });

  assert.equal(normalized.status, "awaiting_account_selection");
});

test("candidate status compatibility maps logical filters to persisted query values", () => {
  assert.deepEqual(
    candidateStatusCompat.mapLogicalStatusesForQuery([
      "awaiting_user_confirmation",
      "needs_clarification",
      "reviewed_confirmed",
      "ignored_pattern",
    ]),
    ["pending_review", "confirmed", "ignored"],
  );
});
