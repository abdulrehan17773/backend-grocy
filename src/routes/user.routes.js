import { Router } from "express";
import { registerUser, loginUser, logout, tokenUpdate } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import {checkAuth} from "../middlewares/checkAuth.middleware.js"

const UserRouter = Router();

// // unsecure routes
UserRouter.route("/register").post(upload.single('avatar'), registerUser);
UserRouter.route("/login").post(loginUser);

// secure routes
UserRouter.route("/logout").post(checkAuth ,logout);
UserRouter.route("/refresh-token").post(tokenUpdate);

export { UserRouter };  
