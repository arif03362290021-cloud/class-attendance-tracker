import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable, classesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import {
  CreateStudentBody,
  UpdateStudentBody,
  GetStudentParams,
  UpdateStudentParams,
  DeleteStudentParams,
  ListStudentsQueryParams,
} from "@workspace/api-zod";

const router = Router();

// List students
router.get("/students", async (req, res) => {
  try {
    const query = ListStudentsQueryParams.safeParse(req.query);
    const classId = query.success && query.data.classId != null ? query.data.classId : undefined;

    const students = await db
      .select()
      .from(studentsTable)
      .where(classId != null ? eq(studentsTable.classId, classId) : undefined);

    res.json(students);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list students" });
  }
});

// Get student
router.get("/students/:id", async (req, res): Promise<void> => {
  try {
    const { id } = GetStudentParams.parse({ id: Number(req.params.id) });
    const student = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student[0]) { res.status(404).json({ error: "Student not found" }); return; }
    res.json(student[0]);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get student" });
  }
});

// Create student
router.post("/students", async (req, res) => {
  try {
    const data = CreateStudentBody.parse(req.body);
    const [student] = await db.insert(studentsTable).values(data).returning();
    res.status(201).json(student);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create student" });
  }
});

// Update student
router.patch("/students/:id", async (req, res): Promise<void> => {
  try {
    const { id } = UpdateStudentParams.parse({ id: Number(req.params.id) });
    const data = UpdateStudentBody.parse(req.body);
    const [student] = await db
      .update(studentsTable)
      .set(data)
      .where(eq(studentsTable.id, id))
      .returning();
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }
    res.json(student);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update student" });
  }
});

// Delete student
router.delete("/students/:id", async (req, res) => {
  try {
    const { id } = DeleteStudentParams.parse({ id: Number(req.params.id) });
    await db.delete(studentsTable).where(eq(studentsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete student" });
  }
});

export default router;
