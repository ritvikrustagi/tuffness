export type AccountHealthLevel = "healthy" | "attention" | "risk" | "onboarding";

export type AccountHealthCounts = {
  projectCount: number;
  memberCount: number;
  documentsProcessed: number;
  pagesProcessed: number;
  aiRunCount: number;
  failedAiRunCount: number;
  openHighRiskCount: number;
  openRfiCount: number;
  submittalsNeedingReviewCount: number;
  lastActivityAt: string | null;
};

export type AccountHealthSummary = AccountHealthCounts & {
  healthLevel: AccountHealthLevel;
  primaryConcern: string;
  activityLabel: string;
};

function formatActivityLabel(value: string | null) {
  if (!value) return "No activity yet";
  return `Last activity ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))}`;
}

export function buildAccountHealthSummary(input: AccountHealthCounts): AccountHealthSummary {
  let healthLevel: AccountHealthLevel = "healthy";
  let primaryConcern = "No major account concerns";

  if (input.projectCount === 0) {
    healthLevel = "onboarding";
    primaryConcern = "No projects created yet";
  } else if (input.failedAiRunCount >= 3) {
    healthLevel = "risk";
    primaryConcern = `${input.failedAiRunCount} failed AI runs need support review`;
  } else if (input.openHighRiskCount > 0) {
    healthLevel = "attention";
    primaryConcern = `${input.openHighRiskCount} high-risk items open`;
  } else if (input.submittalsNeedingReviewCount > 0) {
    healthLevel = "attention";
    primaryConcern = `${input.submittalsNeedingReviewCount} submittals need review`;
  }

  return {
    ...input,
    healthLevel,
    primaryConcern,
    activityLabel: formatActivityLabel(input.lastActivityAt),
  };
}
