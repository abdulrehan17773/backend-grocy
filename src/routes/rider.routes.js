import { Router } from "express"
import { checkAuth, checkRider, checkAdmin } from "../middlewares/checkAuth.middleware.js"
import { upload } from "../middlewares/multer.middleware.js"
import { createRider } from "../controllers/rider.controllers.js"

const riderRouter = Router();

riderRouter.route("/create").post(checkAuth, checkAdmin, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 },
    { name: 'licenseFront', maxCount: 1 },
    { name: 'licenseBack', maxCount: 1 }
]), createRider)

export {riderRouter}