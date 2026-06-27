// Shared stops: appear in multiple branches (cross-line or within Green Line).
// All reads/writes use the canonical branch as the DB key.

// stop_id → the single branch_id used for DB storage
export const CANONICAL_BRANCH: Record<string, string> = {
  "park-street":       "red-trunk",
  "downtown-crossing": "red-trunk",
  "state":             "orange-main",
  "government-center": "blue-main",
  "haymarket":         "orange-main",
  "north-station":     "orange-main",
  "east-somerville":   "green-b",
};

// stop_id → all branch_ids that contain this stop (canonical first)
export const SHARED_BRANCHES: Record<string, string[]> = {
  "park-street":       ["red-trunk",   "green-trunk"],
  "downtown-crossing": ["red-trunk",   "orange-main"],
  "state":             ["orange-main", "blue-main"],
  "government-center": ["blue-main",   "green-trunk"],
  "haymarket":         ["orange-main", "green-trunk"],
  "north-station":     ["orange-main", "green-trunk"],
  "east-somerville":   ["green-b",     "green-d"],
};

export function canonicalize(branchId: string, stopId: string): string {
  return CANONICAL_BRANCH[stopId] ?? branchId;
}
