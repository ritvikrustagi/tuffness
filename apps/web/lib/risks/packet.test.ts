import { describe, expect, test } from "vitest";
import {
  buildCompliancePacketDownloadName,
  buildCompliancePacketText,
} from "./packet";

describe("compliance packet export", () => {
  test("builds a send-ready packet with evidence and draft RFI", () => {
    const packet = buildCompliancePacketText({
      risk: {
        summary: "Door rating mismatch",
        risk_tier: "high",
        risk_score: 82,
        risk_category: "possible_spec_deviation",
        compliance_impact: "code_or_life_safety",
        required_artifact: "rfi",
        spec_section: "08 11 13",
        drawing_sheet: "A601",
        responsible_party: "Architect",
        responsible_trade: "doors",
        confidence: 0.87,
        status: "draft_rfi",
        recommended_action: "Send RFI before release.",
        evidence: [
          {
            document_name: "A601 Door Schedule",
            page_number: 12,
            quote: "Door 101 has no listed rating.",
          },
        ],
      },
      draftRfi: "Please confirm the required fire rating for Door 101.",
    });

    expect(packet).toContain("Compliance Packet: Door rating mismatch");
    expect(packet).toContain("Risk Tier: high");
    expect(packet).toContain("Risk Score: 82");
    expect(packet).toContain("Compliance Impact: code or life safety");
    expect(packet).toContain("Required Artifact: rfi");
    expect(packet).toContain("Spec Section: 08 11 13");
    expect(packet).toContain("Drawing Sheet: A601");
    expect(packet).toContain("Responsible: Architect / doors");
    expect(packet).toContain("Confidence: 87%");
    expect(packet).toContain("Workflow Status: draft rfi");
    expect(packet).toContain("Recommended Action: Send RFI before release.");
    expect(packet).toContain("1. A601 Door Schedule, page 12: Door 101 has no listed rating.");
    expect(packet).toContain("Draft RFI:\nPlease confirm the required fire rating for Door 101.");
  });

  test("uses fallbacks for missing packet fields", () => {
    const packet = buildCompliancePacketText({
      risk: {
        summary: null,
        risk_tier: null,
        risk_score: null,
        risk_category: null,
        compliance_impact: null,
        required_artifact: null,
        spec_section: null,
        drawing_sheet: null,
        responsible_party: null,
        responsible_trade: null,
        trade: null,
        confidence: null,
        status: null,
        recommended_action: null,
        evidence: [],
      },
    });

    expect(packet).toContain("Compliance Packet: Untitled item");
    expect(packet).toContain("Risk Tier: Not specified");
    expect(packet).toContain("Responsible: Not assigned");
    expect(packet).toContain("1. Evidence excerpt unavailable.");
    expect(packet).not.toContain("Draft RFI:");
    expect(packet).not.toContain("undefined");
  });

  test("builds stable packet download filenames", () => {
    expect(buildCompliancePacketDownloadName(" Door / Hardware Conflict ")).toBe(
      "door-hardware-conflict-compliance-packet.txt"
    );
    expect(buildCompliancePacketDownloadName(null)).toBe("compliance-packet.txt");
  });
});
