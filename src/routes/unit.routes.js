import router from "express";
import { checkAuth } from "../middlewares/checkAuth.middleware.js";
import { getAllUnit, createUnit, delUnit, updateUnit } from "../controllers/unit.controllers.js";

const unitRouter = router();

unitRouter.use(checkAuth)
unitRouter.route("/getall").get(getAllUnit)
unitRouter.route("/create").post(createUnit)
unitRouter.route("/delete").patch(delUnit)
unitRouter.route("/update").patch(updateUnit)

export {unitRouter};