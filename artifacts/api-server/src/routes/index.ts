import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import dishesRouter from "./dishes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(dishesRouter);

export default router;
