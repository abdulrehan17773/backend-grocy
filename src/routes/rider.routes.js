import { Router } from "express"
import { checkAuth, checkAdmin } from "../middlewares/checkAuth.middleware.js"
import { upload } from "../middlewares/multer.middleware.js"
import { createRider } from "../controllers/rider.controllers.js"

const riderRouter = Router();

riderRouter.route("/create").post(createRider)

export {riderRouter}