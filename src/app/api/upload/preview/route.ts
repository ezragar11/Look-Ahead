import { NextRequest, NextResponse } from "next/server";
import { parseLookaheadFile } from "@/lib/parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an .xlsx or .xls file." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = parseLookaheadFile(buffer);

    const categories = [...new Set(parsed.activities.map((a) => a.category))];
    const subcontractors = [...new Set(parsed.activities.map((a) => a.responsibleSubcontractorRaw).filter(Boolean))];
    const locations = [...new Set(parsed.activities.map((a) => a.location).filter(Boolean))];

    const totalOccurrences = parsed.activities.reduce((s, a) => s + a.occurrences.length, 0);
    const missingLocation = parsed.activities.filter((a) => !a.location).length;
    const missingSub = parsed.activities.filter((a) => !a.responsibleSubcontractorRaw).length;
    const missingFinish = parsed.activities.filter((a) => a.occurrences.length > 0 && !a.plannedFinish).length;

    const warnings: string[] = [];
    if (missingLocation > 0) warnings.push(`${missingLocation} activities missing location`);
    if (missingSub > 0) warnings.push(`${missingSub} activities missing subcontractor`);
    if (missingFinish > 0) warnings.push(`${missingFinish} activities have planned dates but no planned finish`);

    return NextResponse.json({
      projectName: parsed.projectName,
      lookaheadName: parsed.lookaheadName,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      activityCount: parsed.activities.length,
      occurrenceCount: totalOccurrences,
      categories,
      subcontractors,
      locations,
      warnings,
      activities: parsed.activities.map((a) => ({
        category: a.category,
        activityDescription: a.activityDescription,
        responsibleSubcontractorRaw: a.responsibleSubcontractorRaw,
        location: a.location,
        plannedStart: a.plannedStart,
        plannedFinish: a.plannedFinish,
        occurrenceCount: a.occurrences.length,
      })),
    });
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file" },
      { status: 500 }
    );
  }
}
