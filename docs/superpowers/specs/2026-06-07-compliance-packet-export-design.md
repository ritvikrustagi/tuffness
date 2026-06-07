# Compliance Packet Export Design

## Goal

Let a GC project engineer turn one AI Risk + Compliance Register item into a clean packet they can paste into email, Procore, meeting minutes, or an RFI workflow.

## Scope

The first pass produces text packets only. The risk detail page adds `Copy packet` and `Export packet` actions. The packet includes the item summary, score/tier, confidence, compliance impact, required artifact, spec section, drawing sheet, responsible party/trade, workflow status, recommended action, evidence excerpts, and draft RFI content when present.

## Architecture

Packet generation lives in a pure helper under `apps/web/lib/risks/packet.ts` so it can be tested without UI. The risk detail hook reuses the current issue and workflow draft to copy or export the packet. No new database tables, RPCs, or document rendering are required.

## Testing

Vitest covers packet formatting, missing-field fallbacks, draft RFI inclusion, and protection against `undefined` output. Existing build, lint, and risk detail tests provide regression coverage for the UI wiring.
