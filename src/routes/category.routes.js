import { Router } from "express";
import { getAllCategory, createCategory, deleteCategory, updateCategory } from "../controllers/category.controllers.js";
import { checkAuth, checkAdmin } from "../middlewares/checkAuth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const catRouter = Router();

catRouter.use(checkAuth)
catRouter.route("/getall").get(getAllCategory)
catRouter.use(checkAdmin)
catRouter.route("/create").post(upload.single("img"), createCategory)
catRouter.route("/delete").patch(deleteCategory)
catRouter.route("/update").patch(upload.single("img"), updateCategory)

export {catRouter};