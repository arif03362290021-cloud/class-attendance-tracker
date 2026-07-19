import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { attendanceTable } from "./attendance";

export const excusesTable = pgTable("excuses", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  attendanceId: integer("attendance_id").references(() => attendanceTable.id, { onDelete: "set null" }),
  excuseText: text("excuse_text").notNull(),
  verdict: text("verdict", { enum: ["Valid", "Invalid", "Needs Review"] }).notNull(),
  confidence: real("confidence"),
  reasoning: text("reasoning").notNull(),
  suggestedAction: text("suggested_action"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExcuseSchema = createInsertSchema(excusesTable).omit({ id: true, createdAt: true });
export type InsertExcuse = z.infer<typeof insertExcuseSchema>;
export type Excuse = typeof excusesTable.$inferSelect;
