import { Router } from "express";
import { checkAuth, checkAdmin } from "../middlewares/checkAuth.middleware.js";
import { placeOrder, getOrder, cancelOrder, orderDetails, preparingOrder, readyOrder, rejectOrder, updateRider } from "../controllers/order.controllers.js"


const orderRouter = Router();
orderRouter.use(checkAuth);
orderRouter.route("/place").post(placeOrder);
orderRouter.route("/getorder").get(getOrder);
orderRouter.route("/cancel").patch(cancelOrder);
orderRouter.route("/orderdetails/:order_id").get(orderDetails);
orderRouter.use(checkAdmin)
orderRouter.route("/preparing").patch(preparingOrder);
orderRouter.route("/ready").patch(readyOrder);
orderRouter.route("/reject").patch(rejectOrder);
orderRouter.route("/updaterider").patch(updateRider);

export {orderRouter};