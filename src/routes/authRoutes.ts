import express from "express";
import { checkAuth, login, logout, register, updateProfile, deleteAccount, verifyOtp, resendOtp } from "../controllers/authController.ts";
import { protectRoute } from "../middlewares/auth.middleware.ts";
const router = express.Router();


router.get("/check", protectRoute, checkAuth);
router.put("/update-profile", protectRoute, updateProfile);

router.post("/signup", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/logout", logout);
router.delete("/delete-account", protectRoute, deleteAccount);

export default router;
