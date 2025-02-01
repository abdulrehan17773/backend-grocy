import { Router } from "express";
import { checkAuth} from "../middlewares/checkAuth.middleware.js";
import { placeOrder, getOrder } from "../controllers/order.controllers.js"


const orderRouter = Router();
orderRouter.use(checkAuth);
orderRouter.route("/place").post(placeOrder);
orderRouter.route("/getorder").get(getOrder);

export {orderRouter};