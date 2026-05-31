import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.ts";
import {
  getMessages,
  getUsersForSidebar,
  sendMessage,
  deleteChat,
  editMessage,
  deleteSingleMessage,
} from "../controllers/messageController.ts";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);
router.delete("/delete/:id", protectRoute, deleteChat);
router.put("/:id", protectRoute, editMessage);
router.delete("/:id", protectRoute, deleteSingleMessage);

export default router;
