import { Router } from "express";
import { registerUser, loginUser, logout, tokenUpdate } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import {checkAuth} from "../middlewares/checkAuth.middleware.js"

const UserRouter = Router();

// // unsecure routes
UserRouter.route("/register").post(registerUser);
UserRouter.route("/login").post(loginUser);

// secure routes
UserRouter.route("/refresh-token").post(tokenUpdate);
UserRouter.use(checkAuth);
UserRouter.route("/logout").post(logout);

export { UserRouter };  
