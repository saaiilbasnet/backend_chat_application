import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.ts";
import {
  createGroup,
  getMyGroups,
  getGroupMessages,
  sendGroupMessage,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  updateGroup,
  deleteGroup,
  editGroupMessage,
  deleteGroupMessage,
} from "../controllers/groupController.ts";

const router = express.Router();

router.get("/", protectRoute, getMyGroups);
router.post("/", protectRoute, createGroup);
router.get("/:groupId/messages", protectRoute, getGroupMessages);
router.post("/:groupId/send", protectRoute, sendGroupMessage);
router.post("/:groupId/members", protectRoute, addGroupMember);
router.delete("/:groupId/members/:userId", protectRoute, removeGroupMember);
router.post("/:groupId/leave", protectRoute, leaveGroup);
router.put("/:groupId", protectRoute, updateGroup);
router.delete("/:groupId", protectRoute, deleteGroup);
router.put("/messages/:messageId", protectRoute, editGroupMessage);
router.delete("/messages/:messageId", protectRoute, deleteGroupMessage);

export default router;
