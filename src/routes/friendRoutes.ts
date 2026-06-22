import express from "express";
import {
  acceptFriendRequest,
  blockUser,
  declineFriendRequest,
  getFriendState,
  searchUsers,
  sendFriendRequest,
  unblockUser,
  unfriendUser,
} from "../controllers/friendController.ts";
import { protectRoute } from "../middlewares/auth.middleware.ts";

const router = express.Router();

router.get("/", protectRoute, getFriendState);
router.get("/search", protectRoute, searchUsers);
router.post("/request/:id", protectRoute, sendFriendRequest);
router.post("/accept/:id", protectRoute, acceptFriendRequest);
router.post("/decline/:id", protectRoute, declineFriendRequest);
router.delete("/:id", protectRoute, unfriendUser);
router.post("/block/:id", protectRoute, blockUser);
router.post("/unblock/:id", protectRoute, unblockUser);

export default router;
