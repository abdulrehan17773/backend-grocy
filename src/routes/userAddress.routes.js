import { Router } from "express";
import {checkAuth} from "../middlewares/checkAuth.middleware.js"
import { createUserAddress ,getCity, getSubCity, getAllUserAddress, deleteUserAddress, updateUserAddress } from "../controllers/address.controllers.js";

const addressRouter = Router();

addressRouter.use(checkAuth)
addressRouter.route('/getCity').get(getCity)
addressRouter.route('/getSubCity').get(getSubCity)
addressRouter.route('/create').post(createUserAddress)
addressRouter.route('/getAll').get(getAllUserAddress)
addressRouter.route('/update').patch(updateUserAddress)
addressRouter.route('/delete').post(deleteUserAddress)

export {addressRouter}