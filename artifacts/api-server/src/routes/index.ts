import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import classesRouter from "./classes";
import attendanceRouter from "./attendance";
import excusesRouter from "./excuses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentsRouter);
router.use(classesRouter);
router.use(attendanceRouter);
router.use(excusesRouter);

export default router;
