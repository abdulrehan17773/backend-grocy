import { Router } from "express";
import { checkAuth} from "../middlewares/checkAuth.middleware.js";
import { placeOrder, getOrder, cancelOrder, orderDetails } from "../controllers/order.controllers.js"


const orderRouter = Router();
orderRouter.use(checkAuth);
orderRouter.route("/place").post(placeOrder);
orderRouter.route("/getorder").get(getOrder);
orderRouter.route("/cancel").patch(cancelOrder);
orderRouter.route("/orderdetails/:order_id").get(orderDetails);

export {orderRouter};