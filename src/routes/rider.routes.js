import { Router } from "express"
import { checkAuth, checkRider, checkAdmin } from "../middlewares/checkAuth.middleware.js"
import { upload } from "../middlewares/multer.middleware.js"
import { createRider, isActive, updateLicenseFront, updateLicenseBack, updateCardFront, updateCardBack, switchSession, updateRider, getRiders } from "../controllers/rider.controllers.js"

const riderRouter = Router();

riderRouter.use(checkAuth);
riderRouter.route("/create").post(checkAdmin, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 },
    { name: 'licenseFront', maxCount: 1 },
    { name: 'licenseBack', maxCount: 1 }
]), createRider);
riderRouter.route( "/updatestatus").patch(checkAdmin, isActive);
riderRouter.route( "/licensefront").patch(checkAdmin,upload.single("licenseFront"), updateLicenseFront);
riderRouter.route( "/licenseback").patch(checkAdmin,upload.single("licenseBack"), updateLicenseBack);
riderRouter.route( "/idcardfront").patch(checkAdmin,upload.single("idCardFront"), updateCardFront);
riderRouter.route( "/idcardback").patch(checkAdmin,upload.single("idCardBack"), updateCardBack);
riderRouter.route( "/updaterider").patch(checkAdmin, updateRider);
riderRouter.route( "/getall").get(checkAdmin, getRiders);
riderRouter.route( "/switchsession").patch(checkRider, switchSession);

export {riderRouter}