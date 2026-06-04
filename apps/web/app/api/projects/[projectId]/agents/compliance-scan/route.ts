import { startProjectRiskScan } from "@/lib/agents/risk/start-scan";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  return startProjectRiskScan({
    projectId,
    mode: "compliance_register_scan",
    label: "compliance",
  });
}
