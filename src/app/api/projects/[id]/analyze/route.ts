import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// Build a concise text representation of the live lookahead schedule
async function buildScheduleText(projectId: string): Promise<string> {
  const activities = await prisma.activity.findMany({
    where:   { projectId, deletedAt: null },
    orderBy: [{ plannedStart: "asc" }, { category: "asc" }],
    include: {
      constraints: {
        where:  { deletedAt: null, status: { not: "RESOLVED" } },
        select: { type: true, title: true, notes: true, status: true },
      },
    },
  });

  if (activities.length === 0) return "No activities found in the current schedule.";

  const lines: string[] = ["CURRENT 3-WEEK LOOKAHEAD SCHEDULE", "=".repeat(40)];
  for (const a of activities) {
    const start = a.plannedStart ? new Date(a.plannedStart).toLocaleDateString("en-US") : "TBD";
    const end   = a.plannedFinish ? new Date(a.plannedFinish).toLocaleDateString("en-US") : "TBD";
    lines.push(
      `\nActivity: ${a.activityDescription}`,
      `  Category: ${a.category ?? "Unknown"} | Status: ${a.status}`,
      `  Dates: ${start} → ${end} | Location: ${a.location ?? "N/A"}`,
      `  Percent Complete: ${a.percentComplete ?? 0}%`,
    );
    if (a.responsibleSubcontractorRaw) lines.push(`  Subcontractor: ${a.responsibleSubcontractorRaw}`);
    if (a.constraints.length > 0) {
      lines.push(`  OPEN CONSTRAINTS (${a.constraints.length}):`);
      a.constraints.forEach((c) => lines.push(`    - [${c.type}/${c.status}] ${c.title}${c.notes ? ": " + c.notes : ""}`));
    }
    if (a.notes) lines.push(`  Notes: ${a.notes}`);
  }
  return lines.join("\n");
}

// Build the system prompt for the AI
function buildSystemPrompt(): string {
  return `You are a senior construction project manager and schedule analyst with 20+ years of experience in commercial and industrial construction. Your role is to analyze 3-week lookahead schedules against project documents (scope of work, blueprints, specifications, submittals) and provide actionable, construction-grade intelligence.

When analyzing, consider:
- Work sequence logic and dependencies
- Trade coordination and crew conflicts
- Scope gaps: work in the documents not appearing in the schedule
- Scope creep: work in the schedule not clearly supported by documents
- Resource loading and crew size adequacy
- Safety and regulatory constraints
- Submittals, RFIs, and long-lead items that may be blocking work
- Weather and site access considerations
- Realistic productivity rates for the trades involved

Always respond with a JSON object matching exactly this structure:
{
  "summary": "2-3 sentence executive summary",
  "overallRisk": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "scorecard": {
    "scheduleCompleteness": 0-100,
    "scopeAlignment": 0-100,
    "resourceAdequacy": 0-100,
    "sequenceLogic": 0-100
  },
  "findings": [
    {
      "severity": "INFO" | "WARNING" | "CRITICAL",
      "category": "SCOPE_GAP" | "SCOPE_CREEP" | "RESOURCE_CONFLICT" | "SEQUENCE_ISSUE" | "MISSING_SUBMITTAL" | "SAFETY" | "COORDINATION" | "GENERAL",
      "title": "Short title",
      "detail": "Full explanation",
      "recommendation": "Specific action to take",
      "affectedActivities": ["activity names if applicable"]
    }
  ],
  "positives": ["Things that look well-planned"],
  "immediateActions": ["Top 3-5 things the superintendent should address before the next weekly meeting"]
}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI analysis is not configured. Add your ANTHROPIC_API_KEY to .env.local." },
        { status: 503 }
      );
    }

    const body        = await req.json();
    const docIds      = (body.documentIds as string[] | undefined) ?? [];
    const title       = (body.title as string | undefined) ?? "Schedule Analysis";
    const analysisType = (body.analysisType as string | undefined) ?? "SCHEDULE_REVIEW";

    // Create analysis record (PENDING)
    const userId = (session.user as { id?: string }).id ?? null;
    const analysis = await prisma.aIAnalysis.create({
      data: {
        projectId:    params.id,
        title,
        analysisType,
        status:       "RUNNING",
        model:        process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
        createdBy:    userId,
      },
    });

    // Fetch selected documents
    const docs = docIds.length > 0
      ? await prisma.projectDocument.findMany({
          where: { id: { in: docIds }, projectId: params.id, deletedAt: null },
        })
      : await prisma.projectDocument.findMany({
          where: { projectId: params.id, deletedAt: null },
        });

    // Link docs to analysis
    if (docs.length > 0) {
      await prisma.aIAnalysisDocument.createMany({
        data: docs.map((d) => ({ analysisId: analysis.id, documentId: d.id })),
      });
    }

    // Build context
    const scheduleText = await buildScheduleText(params.id);
    const docParts: string[] = [];

    for (const doc of docs) {
      if (doc.extractedText) {
        const preview = doc.extractedText.length > 8000
          ? doc.extractedText.slice(0, 8000) + "\n... [truncated]"
          : doc.extractedText;
        docParts.push(`\n\n--- DOCUMENT: ${doc.name} (${doc.type}) ---\n${preview}`);
      }
    }

    const userMessage = docParts.length > 0
      ? `Please analyze this project.\n\n${scheduleText}\n\nPROJECT DOCUMENTS:${docParts.join("")}`
      : `Please analyze this project schedule. Note: no project documents were provided, so focus only on internal schedule quality.\n\n${scheduleText}`;

    // Call Claude
    const client = new Anthropic({ apiKey });
    const model  = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

    let resultJson:    string | null = null;
    let errorMessage:  string | null = null;
    let inputTokens:   number | null = null;
    let outputTokens:  number | null = null;
    let finalStatus = "COMPLETED";

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system:     buildSystemPrompt(),
        messages:   [{ role: "user", content: userMessage }],
      });

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      inputTokens  = response.usage?.input_tokens  ?? null;
      outputTokens = response.usage?.output_tokens ?? null;

      // Extract JSON from the response (model sometimes wraps in ```json ... ```)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/);
      const raw = jsonMatch ? jsonMatch[1] : text;

      // Validate it parses
      JSON.parse(raw);
      resultJson = raw;
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      errorMessage = msg;
      finalStatus  = "FAILED";
    }

    // Update analysis record
    const updated = await prisma.aIAnalysis.update({
      where: { id: analysis.id },
      data: {
        status:       finalStatus,
        resultJson,
        errorMessage,
        inputTokens,
        outputTokens,
        completedAt:  new Date(),
      },
    });

    return NextResponse.json(updated, { status: finalStatus === "COMPLETED" ? 200 : 422 });
  } catch (err) {
    console.error("POST /api/projects/[id]/analyze error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

// GET — fetch previous analyses for the project
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const analyses = await prisma.aIAnalysis.findMany({
      where:   { projectId: params.id },
      orderBy: { createdAt: "desc" },
      take:    20,
    });

    return NextResponse.json(analyses);
  } catch (err) {
    console.error("GET /api/projects/[id]/analyze error:", err);
    return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 });
  }
}
