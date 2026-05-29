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

    const userId = (session.user as { id: string }).id;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    // Permission check: only work managers can upload schedules
    if (projectId) {
      const role = await getProjectRole(userId, projectId);
      if (!canManageWork(role)) {
        return NextResponse.json({ error: "View-only users cannot upload schedules" }, { status: 403 });
      }
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10 MB." }, { status: 400 });
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

    // Run entire import in a transaction so other pages don't see partial data
    const txResult = await prisma.$transaction(async (tx) => {
      const lookahead = await tx.lookahead.create({
        data: {
          projectId:      project!.id,
          name:           parsed.lookaheadName,
          sourceFileName: file!.name,
          startDate:      parsed.startDate,
          endDate:        parsed.endDate,
          createdBy:      userId,
        },
      });

      await tx.auditLog.create({
        data: {
          projectId: project!.id,
          userId,
          changedBy: userId,
          entityType: "LOOKAHEAD",
          entityId: lookahead.id,
          action: "CREATED",
          newValue: file!.name,
        },
      });

      const projectLocations = await tx.projectLocation.findMany({
        where: { projectId: project!.id, deletedAt: null },
        select: { id: true, name: true },
      });
      const locationMap = new Map<string, string>();
      for (const loc of projectLocations) {
        locationMap.set(loc.name.toLowerCase().trim(), loc.id);
      }

      const seenLocations = new Set<string>();
      for (const pa of parsed.activities) {
        const locText = pa.location?.trim();
        if (!locText) continue;
        const key = locText.toLowerCase();
        if (locationMap.has(key) || seenLocations.has(key)) continue;
        seenLocations.add(key);
        const newLoc = await tx.projectLocation.create({
          data: { projectId: project!.id, name: locText, sortOrder: locationMap.size + seenLocations.size },
        });
        locationMap.set(key, newLoc.id);
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
            const sub = await tx.subcontractor.upsert({
              where:  { name: subName },
              update: {},
              create: { name: subName },
            });
            subCache.set(key, sub.id);

            await tx.subcontractorProject.upsert({
              where: {
                subcontractorId_projectId: {
                  subcontractorId: sub.id,
                  projectId: project!.id,
                },
              },
              update: {},
              create: {
                subcontractorId: sub.id,
                projectId:       project!.id,
              },
            });
          }

          if (!primarySubId) primarySubId = subCache.get(key) ?? null;
        }

        const locText = pa.location?.trim() || null;
        const matchedLocationId = locText ? locationMap.get(locText.toLowerCase()) ?? null : null;

        const activity = await tx.activity.create({
          data: {
            projectId:                  project!.id,
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
          await tx.activityOccurrence.create({
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

      return { lookaheadId: lookahead.id, activityCount, occurrenceCount };
    }, { timeout: 60000 });

    let conflictsFound = 0;
    try {
      conflictsFound = await runConflictDetection(project.id);
    } catch (err) {
      console.error("Conflict detection error (non-fatal):", err);
    }

    return NextResponse.json({
      success:            true,
      projectId:          project.id,
      lookaheadId:        txResult.lookaheadId,
      projectName:        parsed.projectName,
      activitiesCreated:  txResult.activityCount,
      activityCount:      txResult.activityCount,
      occurrenceCount:    txResult.occurrenceCount,
      conflictsFound,
      message: `Imported ${txResult.activityCount} activities with ${txResult.occurrenceCount} planned work days.${conflictsFound > 0 ? ` ${conflictsFound} potential conflicts detected.` : ""}`,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file" },
      { status: 500 }
    );
  }
}
