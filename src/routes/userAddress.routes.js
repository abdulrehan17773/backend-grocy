import { Router } from "express";
import {checkAuth} from "../middlewares/checkAuth.middleware.js"
import { createUserAddress } from "../controllers/address.controllers.js";

const addressRouter = Router();

addressRouter.use(checkAuth)
addressRouter.route('/create').post(createUserAddress)

export {addressRouter}