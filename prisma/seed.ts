/**
 * Seed script for LookAhead Pro
 * Creates realistic construction data for testing.
 *
 * Usage:  npm run db:seed   (calls tsx prisma/seed.ts)
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { hashSync } from "bcryptjs";

// Load env vars from .env.local (Next.js does this automatically, but tsx doesn't)
try {
  const envContent = readFileSync(".env.local", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local may not exist if DATABASE_URL is already set */ }

const prisma = new PrismaClient();

// ── helpers ────────────────────────────────────────────────────────────────
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(7, 0, 0, 0);
  return d;
}

function today(): Date {
  const d = new Date();
  d.setHours(7, 0, 0, 0);
  return d;
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding LookAhead Pro…");

  // 1. Find existing user + company + project
  const user = await prisma.user.findFirst({ where: { email: "emottern@burnsmcd.com" } });
  if (!user) throw new Error("Seed requires existing user emottern@burnsmcd.com — log in first.");

  const company = await prisma.company.findFirst({ where: { slug: "burns-mcdonnell" } });
  if (!company) throw new Error("Company burns-mcdonnell not found.");

  let project = await prisma.project.findFirst({
    where: { companyId: company.id, slug: "watson-substation", deletedAt: null },
  });
  if (!project) {
    project = await prisma.project.findFirst({
      where: { companyId: company.id, deletedAt: null },
    });
  }
  if (!project) throw new Error("No active project found.");

  console.log(`  Project: ${project.projectName} (${project.id})`);

  // 2. Upsert 5 subcontractors ──────────────────────────────────────────────
  const subDefs = [
    { name: "Midwest Electric Co.",   trade: "Electrical" },
    { name: "Allied Steel Erectors",  trade: "Structural Steel" },
    { name: "Apex Concrete",          trade: "Civil / Concrete" },
    { name: "ProGrade Mechanical",    trade: "Mechanical / Piping" },
    { name: "SafePoint Controls",     trade: "Instrumentation & Controls" },
  ];

  const subs: Awaited<ReturnType<typeof prisma.subcontractor.upsert>>[] = [];
  for (const sd of subDefs) {
    const sub = await prisma.subcontractor.upsert({
      where: { name: sd.name },
      update: { trade: sd.trade, companyId: company.id },
      create: { name: sd.name, trade: sd.trade, companyId: company.id },
    });
    // Link to project
    await prisma.subcontractorProject.upsert({
      where: { subcontractorId_projectId: { subcontractorId: sub.id, projectId: project.id } },
      update: {},
      create: { subcontractorId: sub.id, projectId: project.id },
    });
    subs.push(sub);
  }
  console.log(`  ✓ ${subs.length} subcontractors`);

  // 3. Upsert 5 project locations ───────────────────────────────────────────
  const locDefs = [
    { name: "Control Building",        zone: "Zone A", color: "#3b82f6" },
    { name: "Transformer Yard",        zone: "Zone A", color: "#ef4444" },
    { name: "Switchgear Room",         zone: "Zone B", color: "#f59e0b" },
    { name: "Cable Trench North",      zone: "Zone B", color: "#10b981" },
    { name: "Perimeter Fence / Gate",  zone: "Zone C", color: "#8b5cf6" },
  ];

  const locs: Awaited<ReturnType<typeof prisma.projectLocation.upsert>>[] = [];
  for (const ld of locDefs) {
    const loc = await prisma.projectLocation.upsert({
      where: { projectId_name: { projectId: project.id, name: ld.name } },
      update: { zone: ld.zone, color: ld.color },
      create: { projectId: project.id, name: ld.name, zone: ld.zone, color: ld.color, sortOrder: locs.length },
    });
    locs.push(loc);
  }
  console.log(`  ✓ ${locs.length} locations`);

  // 4. Create one lookahead ──────────────────────────────────────────────────
  const lookahead = await prisma.lookahead.create({
    data: {
      projectId: project.id,
      name: "3-Week Lookahead — Week of " + today().toLocaleDateString(),
      sourceFileName: "seed-data.xlsx",
      startDate: daysFromNow(-2),
      endDate: daysFromNow(19),
      createdBy: user.id,
    },
  });
  console.log(`  ✓ Lookahead: ${lookahead.name}`);

  // 5. Create 20 activities ──────────────────────────────────────────────────
  const actDefs = [
    // Week 1 — this week
    { desc: "Install 138kV bus supports",              sub: 1, loc: 1, startOff: -1, dur: 3, status: "IN_PROGRESS", pct: 40, cat: "Structural" },
    { desc: "Pull primary cable — Feeder 1",           sub: 0, loc: 3, startOff: 0,  dur: 2, status: "IN_PROGRESS", pct: 25, cat: "Electrical" },
    { desc: "Pour transformer pad foundation",         sub: 2, loc: 1, startOff: -2, dur: 2, status: "COMPLETE",    pct: 100,cat: "Civil" },
    { desc: "Set control building HVAC units",         sub: 3, loc: 0, startOff: 0,  dur: 1, status: "PLANNED",     pct: 0,  cat: "Mechanical" },
    { desc: "Trench grounding grid — Phase 1",         sub: 0, loc: 3, startOff: 1,  dur: 3, status: "PLANNED",     pct: 0,  cat: "Electrical" },
    { desc: "Relocate temporary fence — south side",   sub: 2, loc: 4, startOff: 0,  dur: 1, status: "IN_PROGRESS", pct: 60, cat: "Civil" },
    { desc: "Terminate CT / PT wiring — Bay 1",        sub: 4, loc: 2, startOff: 2,  dur: 2, status: "PLANNED",     pct: 0,  cat: "I&C" },
    // Week 2
    { desc: "Erect steel for relay house addition",    sub: 1, loc: 0, startOff: 5,  dur: 4, status: "PLANNED",     pct: 0,  cat: "Structural" },
    { desc: "Install cable tray in trench",            sub: 0, loc: 3, startOff: 5,  dur: 3, status: "PLANNED",     pct: 0,  cat: "Electrical" },
    { desc: "Fire-stop penetrations — Control Bldg",   sub: 3, loc: 0, startOff: 6,  dur: 2, status: "PLANNED",     pct: 0,  cat: "Mechanical" },
    { desc: "Receive & set 138kV transformer",         sub: 1, loc: 1, startOff: 7,  dur: 2, status: "PLANNED",     pct: 0,  cat: "Structural", materialReq: true },
    { desc: "Install security camera conduit",         sub: 0, loc: 4, startOff: 8,  dur: 2, status: "PLANNED",     pct: 0,  cat: "Electrical" },
    { desc: "Backfill & compact around foundations",    sub: 2, loc: 1, startOff: 8,  dur: 2, status: "PLANNED",     pct: 0,  cat: "Civil" },
    // Week 3
    { desc: "Switchgear assembly & alignment",         sub: 0, loc: 2, startOff: 12, dur: 4, status: "PLANNED",     pct: 0,  cat: "Electrical", inspReq: true },
    { desc: "Weld bus connections — 138kV",            sub: 1, loc: 1, startOff: 12, dur: 3, status: "PLANNED",     pct: 0,  cat: "Structural" },
    { desc: "Install fire suppression piping",         sub: 3, loc: 0, startOff: 13, dur: 2, status: "PLANNED",     pct: 0,  cat: "Mechanical" },
    { desc: "Pull control cables — Bays 1-4",         sub: 4, loc: 3, startOff: 14, dur: 3, status: "PLANNED",     pct: 0,  cat: "I&C" },
    { desc: "Grade & gravel access road",              sub: 2, loc: 4, startOff: 14, dur: 2, status: "PLANNED",     pct: 0,  cat: "Civil" },
    // Overdue / problem activities
    { desc: "Outage coordination with utility",        sub: 0, loc: 1, startOff: -5, dur: 1, status: "DELAYED",     pct: 0,  cat: "Electrical", needsFollow: true },
    { desc: "Concrete batch plant mobilization",       sub: 2, loc: 4, startOff: -4, dur: 2, status: "BLOCKED",     pct: 10, cat: "Civil" },
  ];

  const activities: Awaited<ReturnType<typeof prisma.activity.create>>[] = [];
  for (const a of actDefs) {
    const start = daysFromNow(a.startOff);
    const finish = daysFromNow(a.startOff + a.dur - 1);
    const act = await prisma.activity.create({
      data: {
        projectId: project.id,
        lookaheadId: lookahead.id,
        activityDescription: a.desc,
        responsibleSubcontractorId: subs[a.sub].id,
        responsibleSubcontractorRaw: subs[a.sub].name,
        locationId: locs[a.loc].id,
        location: locs[a.loc].name,
        plannedStart: start,
        plannedFinish: finish,
        status: a.status,
        percentComplete: a.pct,
        category: a.cat,
        priority: a.status === "DELAYED" || a.status === "BLOCKED" ? "HIGH" : "MEDIUM",
        needsFollowUp: (a as any).needsFollow ?? false,
        inspectionRequired: (a as any).inspReq ?? false,
        materialRequired: (a as any).materialReq ?? false,
      },
    });

    // Create daily occurrences
    for (let d = 0; d < a.dur; d++) {
      const occDate = daysFromNow(a.startOff + d);
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      await prisma.activityOccurrence.create({
        data: {
          activityId: act.id,
          plannedDate: occDate,
          dayOfWeek: dayNames[occDate.getDay()],
          plannedWeekLabel: `Week ${Math.floor((a.startOff + d + 2) / 7) + 1}`,
          status: a.status === "COMPLETE" ? "COMPLETE" : d <= 0 && a.pct > 0 ? "IN_PROGRESS" : "PLANNED",
        },
      });
    }

    activities.push(act);
  }
  console.log(`  ✓ ${activities.length} activities (with occurrences)`);

  // 6. Create 3 conflicts (with activity links) ─────────────────────────────
  const conflictDefs = [
    {
      title: "Trade overlap — Transformer Yard congestion",
      description: "Allied Steel and Apex Concrete both scheduled in Transformer Yard on same days. Crane swing radius conflicts with concrete pour forms.",
      type: "TRADE_OVERLAP",
      severity: "HIGH",
      loc: 1,
      actIds: [10, 12],  // "Receive transformer" and "Backfill around foundations"
    },
    {
      title: "Crew availability — Midwest Electric double-booked",
      description: "Midwest Electric scheduled in Cable Trench North and Switchgear Room simultaneously. Insufficient crew for both locations.",
      type: "CREW_CONFLICT",
      severity: "MEDIUM",
      loc: 3,
      actIds: [8, 13],  // "Install cable tray" and "Switchgear assembly"
    },
    {
      title: "Sequence issue — Cable pull before tray install",
      description: "Pull control cables (Bay 1-4) scheduled before cable tray installation is complete. Must resequence.",
      type: "SEQUENCE",
      severity: "HIGH",
      loc: 3,
      actIds: [8, 16],  // "Install cable tray" and "Pull control cables"
    },
  ];

  for (const cd of conflictDefs) {
    const conflict = await prisma.conflict.create({
      data: {
        projectId: project.id,
        title: cd.title,
        description: cd.description,
        conflictType: cd.type,
        severity: cd.severity,
        status: "OPEN",
        locationId: locs[cd.loc].id,
        location: locs[cd.loc].name,
        isAutoDetected: true,
        dateIdentified: daysFromNow(-1),
        neededBy: daysFromNow(5),
      },
    });
    for (const idx of cd.actIds) {
      if (activities[idx]) {
        await prisma.conflictActivity.create({
          data: { conflictId: conflict.id, activityId: activities[idx].id },
        });
      }
    }
  }
  console.log("  ✓ 3 conflicts");

  // 7. Create 3 urgent alerts ────────────────────────────────────────────────
  const alertDefs = [
    {
      title: "Crane inspection expired — Transformer Yard",
      type: "SAFETY",
      priority: "URGENT",
      locationIdx: 1,
      actIdx: 10,
      subIdx: 1,
      desc: "Allied Steel's 80-ton crane certification expired yesterday. No lifts permitted until re-inspection. Contact Allied Steel safety officer.",
    },
    {
      title: "Missing RFI response — switchgear anchor bolt pattern",
      type: "MATERIAL",
      priority: "HIGH",
      locationIdx: 2,
      actIdx: 13,
      subIdx: 0,
      desc: "RFI #047 submitted 12 days ago. Switchgear vendor has not confirmed anchor bolt pattern. Assembly cannot proceed without approval.",
    },
    {
      title: "Road closure blocks concrete deliveries Friday",
      type: "ACCESS",
      priority: "URGENT",
      locationIdx: 4,
      actIdx: 19,
      subIdx: 2,
      desc: "County road 12 closed for bridge repair Friday-Saturday. Batch plant trucks use this route. Need alternate route or reschedule pour.",
    },
  ];

  for (const ad of alertDefs) {
    await prisma.alert.create({
      data: {
        projectId: project.id,
        title: ad.title,
        description: ad.desc,
        alertType: ad.type,
        priority: ad.priority,
        status: "OPEN",
        locationId: locs[ad.locationIdx].id,
        activityId: activities[ad.actIdx]?.id ?? null,
        subcontractorId: subs[ad.subIdx].id,
        createdById: user.id,
      },
    });
  }
  console.log("  ✓ 3 alerts");

  // 8. Create 4 field notes ──────────────────────────────────────────────────
  const noteDefs = [
    { text: "Soil conditions softer than expected near transformer pad. May need additional compaction passes.", actIdx: 2 },
    { text: "Midwest Electric foreman requested 2 extra electricians next week for cable pull. Awaiting confirmation.", actIdx: 1 },
    { text: "Safety walk-down noted missing barricade tape around open trench. Corrected immediately.", actIdx: 4, conflict: false },
    { text: "Client engineer visited site — wants conduit routing changed in control building per Rev 3 drawings.", actIdx: 3 },
  ];

  for (const nd of noteDefs) {
    await prisma.note.create({
      data: {
        projectId: project.id,
        activityId: activities[nd.actIdx]?.id ?? null,
        noteText: nd.text,
        author: user.name,
        isPublic: true,
      },
    });
  }
  console.log("  ✓ 4 notes");

  // 9. Create 2 constraints ──────────────────────────────────────────────────
  await prisma.constraint.create({
    data: {
      projectId: project.id,
      activityId: activities[10]?.id,  // Receive transformer
      title: "138kV transformer delivery confirmation",
      type: "MATERIAL",
      status: "OPEN",
      priority: "HIGH",
      responsibleParty: "Allied Steel Erectors / Vendor",
      neededBy: daysFromNow(5),
      notes: "Transformer shipping from manufacturer. Delivery window TBD. Need crane pad ready 2 days before arrival.",
      createdBy: user.id,
    },
  });
  await prisma.constraint.create({
    data: {
      projectId: project.id,
      activityId: activities[13]?.id,  // Switchgear assembly
      title: "Utility outage coordination approval",
      type: "PERMIT",
      status: "IN_PROGRESS",
      priority: "HIGH",
      responsibleParty: "Burns & McDonnell / Utility",
      neededBy: daysFromNow(10),
      notes: "Outage window requested for energization testing. Utility scheduling review in progress.",
      createdBy: user.id,
    },
  });
  console.log("  ✓ 2 constraints");

  // 10. Create 2 delays ──────────────────────────────────────────────────────
  await prisma.delay.create({
    data: {
      projectId: project.id,
      activityId: activities[18]?.id,  // Outage coordination (delayed)
      subcontractorId: subs[0].id,
      title: "Utility outage rescheduled — 5-day slip",
      delayType: "THIRD_PARTY",
      startDate: daysFromNow(-5),
      daysDelayed: 5,
      cause: "Utility rescheduled outage window due to storm restoration priority.",
      responsibleParty: "Regional Utility Co.",
      impact: "Pushes energization testing by one week. Cascading impact on commissioning milestones.",
      status: "OPEN",
      createdBy: user.id,
    },
  });
  await prisma.delay.create({
    data: {
      projectId: project.id,
      activityId: activities[19]?.id,  // Concrete batch plant (blocked)
      subcontractorId: subs[2].id,
      title: "Batch plant mobilization stuck — access permit",
      delayType: "PERMIT",
      startDate: daysFromNow(-4),
      daysDelayed: 4,
      cause: "County has not issued heavy-vehicle access permit for batch plant setup area.",
      responsibleParty: "Apex Concrete / County",
      impact: "Delays all remaining foundation pours. 2 activities on critical path.",
      status: "OPEN",
      createdBy: user.id,
    },
  });
  console.log("  ✓ 2 delays");

  // 11. Audit log entries so audit page isn't empty ──────────────────────────
  const auditEntries = [
    { entityType: "ACTIVITY", action: "CREATED", field: null, old: null, newVal: null },
    { entityType: "ACTIVITY", action: "STATUS_CHANGED", field: "status", old: "PLANNED", newVal: "IN_PROGRESS" },
    { entityType: "CONFLICT", action: "CREATED", field: null, old: null, newVal: null },
    { entityType: "ALERT", action: "CREATED", field: null, old: null, newVal: null },
    { entityType: "ALERT", action: "STATUS_CHANGED", field: "priority", old: "MEDIUM", newVal: "URGENT" },
    { entityType: "CONSTRAINT", action: "CREATED", field: null, old: null, newVal: null },
  ];

  for (const ae of auditEntries) {
    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        userId: user.id,
        changedBy: user.id,
        entityType: ae.entityType,
        entityId: activities[0]?.id ?? "seed",
        action: ae.action,
        fieldChanged: ae.field,
        oldValue: ae.old,
        newValue: ae.newVal,
      },
    });
  }
  console.log("  ✓ 6 audit log entries");

  // 12. Demo users with different roles ──────────────────────────────────────
  const demoPassword = hashSync("demo1234", 12);
  const demoUsers = [
    { name: "Maria Chen",       email: "maria@demo.lookaheadpro.com",   role: "PROJECT_MANAGER" },
    { name: "James Thompson",   email: "james@demo.lookaheadpro.com",   role: "SUPERINTENDENT" },
    { name: "Sarah Kim",        email: "sarah@demo.lookaheadpro.com",   role: "ENGINEER" },
    { name: "Mike Rodriguez",   email: "mike@demo.lookaheadpro.com",    role: "SUBCONTRACTOR" },
    { name: "Pat Davis",        email: "pat@demo.lookaheadpro.com",     role: "OWNER_VIEWER" },
  ];

  for (const du of demoUsers) {
    const demoUser = await prisma.user.upsert({
      where: { email: du.email },
      update: { name: du.name, passwordHash: demoPassword },
      create: {
        name: du.name,
        email: du.email,
        passwordHash: demoPassword,
        status: "ACTIVE",
        globalRole: "USER",
      },
    });
    await prisma.companyUser.upsert({
      where: { companyId_userId: { companyId: company.id, userId: demoUser.id } },
      update: { role: du.role === "SUBCONTRACTOR" || du.role === "OWNER_VIEWER" ? "VIEWER" : "OPERATIONS_MANAGER" },
      create: { companyId: company.id, userId: demoUser.id, role: du.role === "SUBCONTRACTOR" || du.role === "OWNER_VIEWER" ? "VIEWER" : "OPERATIONS_MANAGER", status: "ACTIVE" },
    });
    await prisma.projectUser.upsert({
      where: { projectId_userId: { projectId: project.id, userId: demoUser.id } },
      update: { role: du.role },
      create: { projectId: project.id, userId: demoUser.id, role: du.role, status: "ACTIVE" },
    });
  }
  console.log("  ✓ 5 demo users (password: demo1234)");

  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
