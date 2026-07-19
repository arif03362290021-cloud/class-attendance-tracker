import { Router } from "express";
import { db } from "@workspace/db";
import { classesTable, studentsTable } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";
import {
  CreateClassBody,
  UpdateClassBody,
  GetClassParams,
  UpdateClassParams,
  DeleteClassParams,
} from "@workspace/api-zod";

const router = Router();

// List classes (with student counts)
router.get("/classes", async (req, res) => {
  try {
    const classes = await db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        subject: classesTable.subject,
        teacherName: classesTable.teacherName,
        schedule: classesTable.schedule,
        room: classesTable.room,
        createdAt: classesTable.createdAt,
        studentCount: sql<number>`cast(count(${studentsTable.id}) as int)`,
      })
      .from(classesTable)
      .leftJoin(studentsTable, eq(studentsTable.classId, classesTable.id))
      .groupBy(classesTable.id);

    res.json(classes);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list classes" });
  }
});

// Get class
router.get("/classes/:id", async (req, res): Promise<void> => {
  try {
    const { id } = GetClassParams.parse({ id: Number(req.params.id) });
    const [cls] = await db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        subject: classesTable.subject,
        teacherName: classesTable.teacherName,
        schedule: classesTable.schedule,
        room: classesTable.room,
        createdAt: classesTable.createdAt,
        studentCount: sql<number>`cast(count(${studentsTable.id}) as int)`,
      })
      .from(classesTable)
      .leftJoin(studentsTable, eq(studentsTable.classId, classesTable.id))
      .where(eq(classesTable.id, id))
      .groupBy(classesTable.id);
    if (!cls) { res.status(404).json({ error: "Class not found" }); return; }
    res.json(cls);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get class" });
  }
});

// Create class
router.post("/classes", async (req, res) => {
  try {
    const data = CreateClassBody.parse(req.body);
    const [cls] = await db.insert(classesTable).values(data).returning();
    res.status(201).json({ ...cls, studentCount: 0 });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create class" });
  }
});

// Update class
router.patch("/classes/:id", async (req, res): Promise<void> => {
  try {
    const { id } = UpdateClassParams.parse({ id: Number(req.params.id) });
    const data = UpdateClassBody.parse(req.body);
    const [cls] = await db
      .update(classesTable)
      .set(data)
      .where(eq(classesTable.id, id))
      .returning();
    if (!cls) { res.status(404).json({ error: "Class not found" }); return; }

    const [studentCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(studentsTable)
      .where(eq(studentsTable.classId, id));

    res.json({ ...cls, studentCount: studentCount?.count ?? 0 });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update class" });
  }
});

// Delete class
router.delete("/classes/:id", async (req, res) => {
  try {
    const { id } = DeleteClassParams.parse({ id: Number(req.params.id) });
    await db.delete(classesTable).where(eq(classesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

export default router;
