import type { AuditActorKind } from "@/lib/types/database";

export type AuditEventPayload = {
  organization_id: string | null;
  actor_user_id: string | null;
  actor_kind: AuditActorKind;
  event_type: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
};

export function buildAuditEventPayload(input: {
  organizationId: string | null;
  actorUserId: string | null;
  actorKind: AuditActorKind;
  eventType: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): AuditEventPayload {
  return {
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    actor_kind: input.actorKind,
    event_type: input.eventType,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
  };
}
