import { Router } from "express";
import { registerUser, loginUser, loginRider, loginAdmin, logout, tokenUpdate, currentUser, verifyUser, resendOtp, updatePhone, updateName, updateAvatar, updatePassword, forgetPassword, sendForgetPassword, checkExpiryForget } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import {checkLogin, checkAuth, checkRiderSession} from "../middlewares/checkAuth.middleware.js"

const UserRouter = Router();

// // unsecure routes
UserRouter.route("/register").post(registerUser);
UserRouter.route("/login").post(checkLogin, loginUser);
UserRouter.route("/loginrider").post(loginRider);
UserRouter.route("/loginadmin").post(loginAdmin);
UserRouter.route("/refresh-token").post(tokenUpdate);
UserRouter.route("/verification").post(verifyUser);
UserRouter.route("/resend-otp").post(resendOtp);
UserRouter.route("/send-forget").post(sendForgetPassword);
UserRouter.route("/forget/:email/:token").get(checkExpiryForget);
UserRouter.route("/forget-password").patch(forgetPassword);
UserRouter.use(checkAuth);
UserRouter.route("/logout").post(checkRiderSession, logout);
UserRouter.route("/current-user").get(currentUser);
UserRouter.route("/update-name").patch(updateName);
UserRouter.route("/update-phone").patch(updatePhone);
UserRouter.route("/update-avatar").patch(upload.single("avatar"), updateAvatar);
UserRouter.route("/update-password").patch(updatePassword);

export { UserRouter };  
