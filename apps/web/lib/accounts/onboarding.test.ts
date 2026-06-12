import { describe, expect, test } from "vitest";
import type { AccountOnboardingEvent } from "@/lib/types/database";
import {
  getCompletedOnboardingSteps,
  getMissingOnboardingSteps,
  getOnboardingProgress,
} from "./onboarding";

function event(event_type: string): Pick<AccountOnboardingEvent, "event_type"> {
  return { event_type };
}

describe("account onboarding", () => {
  test("calculates completed, missing, and percent progress from events", () => {
    const events = [
      event("organization_profile_completed"),
      event("first_project_created"),
    ];

    expect(getCompletedOnboardingSteps(events)).toEqual([
      "organization_profile_completed",
      "first_project_created",
    ]);
    expect(getMissingOnboardingSteps(events)).toContain("first_risk_scan_completed");
    expect(getOnboardingProgress(events)).toEqual({
      completed: ["organization_profile_completed", "first_project_created"],
      missing: [
        "first_document_uploaded",
        "first_risk_scan_completed",
        "first_packet_exported",
      ],
      percentComplete: 40,
    });
  });

  test("ignores duplicate and unknown onboarding events", () => {
    const progress = getOnboardingProgress([
      event("organization_profile_completed"),
      event("organization_profile_completed"),
      event("unknown_future_event"),
    ]);

    expect(progress.completed).toEqual(["organization_profile_completed"]);
    expect(progress.percentComplete).toBe(20);
  });

  test("returns zero progress for empty events", () => {
    expect(getOnboardingProgress([])).toEqual({
      completed: [],
      missing: [
        "organization_profile_completed",
        "first_project_created",
        "first_document_uploaded",
        "first_risk_scan_completed",
        "first_packet_exported",
      ],
      percentComplete: 0,
    });
  });
});
