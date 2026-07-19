import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, studentsTable, classesTable } from "@workspace/db";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import {
  CreateAttendanceBody,
  UpdateAttendanceBody,
  UpdateAttendanceParams,
  BulkUpsertAttendanceBody,
  ListAttendanceQueryParams,
  GetAttendanceStatsQueryParams,
  GetAttendanceTrendsQueryParams,
  GetAtRiskStudentsQueryParams,
} from "@workspace/api-zod";

const router = Router();

// NOTE: specific paths must come before parameterized paths
// List attendance records
router.get("/attendance", async (req, res) => {
  try {
    const query = ListAttendanceQueryParams.safeParse(req.query);
    const params = query.success ? query.data : {};

    const conditions = [];
    if (params.classId != null) conditions.push(eq(attendanceTable.classId, params.classId));
    if (params.studentId != null) conditions.push(eq(attendanceTable.studentId, params.studentId));
    if (params.date) conditions.push(eq(attendanceTable.date, params.date));

    const records = await db
      .select({
        id: attendanceTable.id,
        studentId: attendanceTable.studentId,
        classId: attendanceTable.classId,
        date: attendanceTable.date,
        status: attendanceTable.status,
        notes: attendanceTable.notes,
        createdAt: attendanceTable.createdAt,
        studentName: studentsTable.name,
      })
      .from(attendanceTable)
      .leftJoin(studentsTable, eq(studentsTable.id, attendanceTable.studentId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(attendanceTable.date);

    res.json(records);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list attendance" });
  }
});

// Attendance stats
router.get("/attendance/stats", async (req, res) => {
  try {
    const query = GetAttendanceStatsQueryParams.safeParse(req.query);
    const params = query.success ? query.data : {};

    const conditions = [];
    if (params.classId != null) conditions.push(eq(attendanceTable.classId, params.classId));
    if (params.startDate) conditions.push(gte(attendanceTable.date, params.startDate));
    if (params.endDate) conditions.push(lte(attendanceTable.date, params.endDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totals] = await db
      .select({
        total: sql<number>`cast(count(*) as int)`,
        presentCount: sql<number>`cast(count(*) filter (where ${attendanceTable.status} = 'present') as int)`,
        absentCount: sql<number>`cast(count(*) filter (where ${attendanceTable.status} = 'absent') as int)`,
        lateCount: sql<number>`cast(count(*) filter (where ${attendanceTable.status} = 'late') as int)`,
        excusedCount: sql<number>`cast(count(*) filter (where ${attendanceTable.status} = 'excused') as int)`,
      })
      .from(attendanceTable)
      .where(where);

    const [studentCount] = await db
      .select({ count: sql<number>`cast(count(distinct ${studentsTable.id}) as int)` })
      .from(studentsTable)
      .where(params.classId != null ? eq(studentsTable.classId, params.classId) : undefined);

    const [dayCount] = await db
      .select({ count: sql<number>`cast(count(distinct ${attendanceTable.date}) as int)` })
      .from(attendanceTable)
      .where(where);

    const total = totals?.total ?? 0;
    const present = totals?.presentCount ?? 0;
    const late = totals?.lateCount ?? 0;

    res.json({
      totalStudents: studentCount?.count ?? 0,
      totalDays: dayCount?.count ?? 0,
      presentCount: present,
      absentCount: totals?.absentCount ?? 0,
      lateCount: late,
      excusedCount: totals?.excusedCount ?? 0,
      attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100 * 10) / 10 : 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// Attendance trends
router.get("/attendance/trends", async (req, res) => {
  try {
    const query = GetAttendanceTrendsQueryParams.safeParse(req.query);
    const params = query.success ? query.data : {};
    const days = params.days ?? 30;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const conditions = [gte(attendanceTable.date, cutoffStr)];
    if (params.classId != null) conditions.push(eq(attendanceTable.classId, params.classId));

    const rows = await db
      .select({
        date: attendanceTable.date,
        total: sql<number>`cast(count(*) as int)`,
        presentCount: sql<number>`cast(count(*) filter (where ${attendanceTable.status} = 'present') as int)`,
        absentCount: sql<number>`cast(count(*) filter (where ${attendanceTable.status} = 'absent') as int)`,
        lateCount: sql<number>`cast(count(*) filter (where ${attendanceTable.status} = 'late') as int)`,
      })
      .from(attendanceTable)
      .where(and(...conditions))
      .groupBy(attendanceTable.date)
      .orderBy(attendanceTable.date);

    const trends = rows.map((r) => ({
      date: r.date,
      presentRate: r.total > 0 ? Math.round((r.presentCount / r.total) * 100 * 10) / 10 : 0,
      absentRate: r.total > 0 ? Math.round((r.absentCount / r.total) * 100 * 10) / 10 : 0,
      lateRate: r.total > 0 ? Math.round((r.lateCount / r.total) * 100 * 10) / 10 : 0,
      totalRecords: r.total,
    }));

    res.json(trends);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get trends" });
  }
});

// At-risk students
router.get("/attendance/at-risk", async (req, res) => {
  try {
    const query = GetAtRiskStudentsQueryParams.safeParse(req.query);
    const params = query.success ? query.data : {};
    const threshold = params.threshold ?? 80;

    const conditions = [];
    if (params.classId != null) conditions.push(eq(attendanceTable.classId, params.classId));

    const rows = await db
      .select({
        studentId: studentsTable.id,
        studentName: studentsTable.name,
        classId: classesTable.id,
        className: classesTable.name,
        totalDays: sql<number>`cast(count(*) as int)`,
        absentDays: sql<number>`cast(count(*) filter (where ${attendanceTable.status} = 'absent') as int)`,
        presentDays: sql<number>`cast(count(*) filter (where ${attendanceTable.status} in ('present','late')) as int)`,
      })
      .from(attendanceTable)
      .innerJoin(studentsTable, eq(studentsTable.id, attendanceTable.studentId))
      .innerJoin(classesTable, eq(classesTable.id, attendanceTable.classId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(studentsTable.id, studentsTable.name, classesTable.id, classesTable.name)
      .having(sql`count(*) > 0`);

    const atRisk = rows
      .map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        classId: r.classId,
        className: r.className,
        attendanceRate: r.totalDays > 0 ? Math.round((r.presentDays / r.totalDays) * 100 * 10) / 10 : 0,
        absentDays: r.absentDays,
        totalDays: r.totalDays,
      }))
      .filter((r) => r.attendanceRate < threshold)
      .sort((a, b) => a.attendanceRate - b.attendanceRate);

    res.json(atRisk);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get at-risk students" });
  }
});

// Create attendance record
router.post("/attendance", async (req, res) => {
  try {
    const data = CreateAttendanceBody.parse(req.body);
    const [record] = await db
      .insert(attendanceTable)
      .values(data)
      .onConflictDoUpdate({
        target: [attendanceTable.studentId, attendanceTable.classId, attendanceTable.date],
        set: { status: data.status, notes: data.notes ?? null },
      })
      .returning();

    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, record.studentId));
    res.status(201).json({ ...record, studentName: student?.name ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create attendance record" });
  }
});

// Bulk upsert attendance
router.post("/attendance/bulk", async (req, res) => {
  try {
    const { classId, date, records } = BulkUpsertAttendanceBody.parse(req.body);

    const values = records.map((r) => ({
      studentId: r.studentId,
      classId,
      date,
      status: r.status as "present" | "absent" | "late" | "excused",
      notes: r.notes,
    }));

    const inserted = await db
      .insert(attendanceTable)
      .values(values)
      .onConflictDoUpdate({
        target: [attendanceTable.studentId, attendanceTable.classId, attendanceTable.date],
        set: {
          status: sql`excluded.status`,
          notes: sql`excluded.notes`,
        },
      })
      .returning();

    const studentIds = inserted.map((r: typeof inserted[number]) => r.studentId);
    const students = await db
      .select()
      .from(studentsTable)
      .where(inArray(studentsTable.id, studentIds));

    const studentMap = new Map(students.map((s) => [s.id, s.name]));

    res.json(inserted.map((r: typeof inserted[number]) => ({ ...r, studentName: studentMap.get(r.studentId) ?? null })));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to bulk upsert attendance" });
  }
});

// Update attendance record
router.patch("/attendance/:id", async (req, res): Promise<void> => {
  try {
    const { id } = UpdateAttendanceParams.parse({ id: Number(req.params.id) });
    const data = UpdateAttendanceBody.parse(req.body);
    const [record] = await db
      .update(attendanceTable)
      .set(data)
      .where(eq(attendanceTable.id, id))
      .returning();
    if (!record) { res.status(404).json({ error: "Record not found" }); return; }

    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, record.studentId));
    res.json({ ...record, studentName: student?.name ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update attendance" });
  }
});

export default router;
