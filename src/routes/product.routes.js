import { Router } from "express";
import { checkAuth, checkAdmin } from "../middlewares/checkAuth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { getAll, createProduct, updateProduct, deleteProduct, featureProduct, activeProduct, deleteImg, updateImg } from "../controllers/product.controllers.js";

const productRouter = Router();

productRouter.route("/getall").get(getAll);
productRouter.use(checkAuth);
productRouter.use(checkAdmin);
productRouter.route("/create").post(upload.array("img"), createProduct);
productRouter.route("/update").patch(upload.array("img"), updateProduct);
productRouter.route("/updateimg").patch(upload.single("img"), updateImg);
productRouter.route("/delete").patch(deleteProduct);
productRouter.route("/active").patch(activeProduct);
productRouter.route("/featured").patch(featureProduct);
productRouter.route("/delimg").patch(deleteImg);

export { productRouter };