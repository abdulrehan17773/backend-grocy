import { Router } from "express";
import { registerUser, loginUser, logout, tokenUpdate, currentUser,verifyUser } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import {checkAuth} from "../middlewares/checkAuth.middleware.js"

const UserRouter = Router();

// // unsecure routes
UserRouter.route("/register").post(registerUser);
UserRouter.route("/login").post(loginUser);

// secure routes
UserRouter.route("/refresh-token").post(tokenUpdate);
UserRouter.route("/verification").post(verifyUser);
UserRouter.use(checkAuth);
UserRouter.route("/logout").post(logout);
UserRouter.route("/current-user").get(currentUser);

export { UserRouter };  
