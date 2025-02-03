import { Router } from "express";
import {checkAuth, checkAdmin} from "../middlewares/checkAuth.middleware.js"
import { createUserAddress ,getCity, getSubCity, getAllUserAddress, deleteUserAddress, updateUserAddress, updateCityStatus, updateSubCityStatus, createSubCity, updateSubCity, delSubCity } from "../controllers/address.controllers.js";

const addressRouter = Router();

addressRouter.use(checkAuth)
addressRouter.route('/getCity').get(getCity)
addressRouter.route('/getSubCity').get(getSubCity)
addressRouter.route('/create').post(createUserAddress)
addressRouter.route('/getAll').get(getAllUserAddress)
addressRouter.route('/update').patch(updateUserAddress)
addressRouter.route('/delete').post(deleteUserAddress)
addressRouter.route('/citystatus').patch(checkAdmin, updateCityStatus)
addressRouter.route('/subcitystatus').patch(checkAdmin, updateSubCityStatus)
addressRouter.route('/createsubcity').post(checkAdmin, createSubCity)
addressRouter.route('/updatesubcity').patch(checkAdmin, updateSubCity)
addressRouter.route('/delsubcity').patch(checkAdmin, delSubCity)

export {addressRouter}