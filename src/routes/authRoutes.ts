import express from "express";
import { checkAuth, login, logout, register, updateProfile, deleteAccount } from "../controllers/authController.ts";
import { protectRoute } from "../middlewares/auth.middleware.ts";
const router = express.Router();


router.get("/check", protectRoute, checkAuth);
router.put("/update-profile", protectRoute, updateProfile);

router.post("/signup", register);
router.post("/login", login);
router.post("/logout", logout);
router.delete("/delete-account", protectRoute, deleteAccount);

export default router;
