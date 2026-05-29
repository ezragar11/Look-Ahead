import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getProjectRole, canManageWork } from "@/lib/access";
import { parseLookaheadFile } from "@/lib/parser";
import { cleanSubcontractorName } from "@/lib/utils";
import { runConflictDetection } from "@/lib/conflicts";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    // Permission check: only work managers can upload schedules
    if (projectId) {
      const userId = (session.user as { id: string }).id;
      const role = await getProjectRole(userId, projectId);
      if (!canManageWork(role)) {
        return NextResponse.json({ error: "View-only users cannot upload schedules" }, { status: 403 });
      }
    }

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

    // Use provided projectId, or fall back to finding/creating by name
    let project;
    if (projectId) {
      project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    } else {
      project = await prisma.project.findFirst({
        where: { projectName: parsed.projectName },
      });
      if (!project) {
        project = await prisma.project.create({
          data: {
            projectName: parsed.projectName,
            client: parsed.projectName.includes("/")
              ? parsed.projectName.split("/").pop()?.trim()
              : null,
          },
        });
      }
    }

    const lookahead = await prisma.lookahead.create({
      data: {
        projectId:      project.id,
        name:           parsed.lookaheadName,
        sourceFileName: file.name,
        startDate:      parsed.startDate,
        endDate:        parsed.endDate,
      },
    });

    // Pre-load project locations for auto-matching location text → locationId
    const projectLocations = await prisma.projectLocation.findMany({
      where: { projectId: project.id, deletedAt: null },
      select: { id: true, name: true },
    });
    const locationMap = new Map<string, string>();
    for (const loc of projectLocations) {
      locationMap.set(loc.name.toLowerCase().trim(), loc.id);
    }

    const subCache = new Map<string, string>();
    let activityCount = 0;
    let occurrenceCount = 0;

    for (const pa of parsed.activities) {
      const subNames = cleanSubcontractorName(pa.responsibleSubcontractorRaw);
      let primarySubId: string | null = null;

      for (const subName of subNames) {
        if (!subName) continue;
        const key = subName.toLowerCase();

        if (!subCache.has(key)) {
          const sub = await prisma.subcontractor.upsert({
            where:  { name: subName },
            update: {},
            create: { name: subName },
          });
          subCache.set(key, sub.id);

          await prisma.subcontractorProject.upsert({
            where: {
              subcontractorId_projectId: {
                subcontractorId: sub.id,
                projectId: project.id,
              },
            },
            update: {},
            create: {
              subcontractorId: sub.id,
              projectId:       project.id,
            },
          });
        }

        if (!primarySubId) primarySubId = subCache.get(key) ?? null;
      }

      // Auto-match location text to a ProjectLocation FK
      const locText = pa.location?.trim() || null;
      const matchedLocationId = locText ? locationMap.get(locText.toLowerCase()) ?? null : null;

      const activity = await prisma.activity.create({
        data: {
          projectId:                  project.id,
          lookaheadId:                lookahead.id,
          category:                   pa.category || "GENERAL",
          activityDescription:        pa.activityDescription,
          responsibleSubcontractorId: primarySubId,
          responsibleSubcontractorRaw: pa.responsibleSubcontractorRaw,
          location:                   locText,
          locationId:                 matchedLocationId,
          plannedStart:               pa.plannedStart ?? null,
          plannedFinish:              pa.plannedFinish ?? null,
          actualStart:                pa.actualStart ?? null,
          actualFinish:               pa.actualFinish ?? null,
          status:                     "PLANNED",
        },
      });
      activityCount++;

      for (const occ of pa.occurrences) {
        await prisma.activityOccurrence.create({
          data: {
            activityId:       activity.id,
            plannedDate:      occ.plannedDate,
            plannedWeekLabel: occ.plannedWeekLabel,
            dayOfWeek:        occ.dayOfWeek,
            isPlanned:        true,
            status:           "PLANNED",
          },
        });
        occurrenceCount++;
      }
    }

    let conflictsFound = 0;
    try {
      conflictsFound = await runConflictDetection(project.id);
    } catch (err) {
      console.error("Conflict detection error (non-fatal):", err);
    }

    return NextResponse.json({
      success:            true,
      projectId:          project.id,
      lookaheadId:        lookahead.id,
      projectName:        parsed.projectName,
      activitiesCreated:  activityCount,
      activityCount,
      occurrenceCount,
      conflictsFound,
      message: `Imported ${activityCount} activities with ${occurrenceCount} planned work days.${conflictsFound > 0 ? ` ${conflictsFound} potential conflicts detected.` : ""}`,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file" },
      { status: 500 }
    );
  }
}
