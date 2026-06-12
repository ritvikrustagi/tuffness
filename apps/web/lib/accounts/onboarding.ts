import type { AccountOnboardingEvent } from "@/lib/types/database";
import { isOnboardingStep, onboardingSteps, type OnboardingStepId } from "./schema";

export type OnboardingEventLike = Pick<AccountOnboardingEvent, "event_type">;

export type OnboardingProgress = {
  completed: OnboardingStepId[];
  missing: OnboardingStepId[];
  percentComplete: number;
};

export function getCompletedOnboardingSteps(events: OnboardingEventLike[]) {
  const completed = new Set<OnboardingStepId>();

  for (const event of events) {
    if (isOnboardingStep(event.event_type)) {
      completed.add(event.event_type);
    }
  }

  return onboardingSteps.filter((step) => completed.has(step));
}

export function getMissingOnboardingSteps(events: OnboardingEventLike[]) {
  const completed = new Set(getCompletedOnboardingSteps(events));
  return onboardingSteps.filter((step) => !completed.has(step));
}

export function getOnboardingProgress(events: OnboardingEventLike[]): OnboardingProgress {
  const completed = getCompletedOnboardingSteps(events);
  const missing = getMissingOnboardingSteps(events);
  const percentComplete = Math.round((completed.length / onboardingSteps.length) * 100);

  return {
    completed,
    missing,
    percentComplete,
  };
}
