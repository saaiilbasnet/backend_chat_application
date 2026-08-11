import { Response } from "express";
import mongoose from "mongoose";
import User from "../database/users/userModel.ts";
import { UserRequest } from "../types/global.types.ts";
import logger from "../lib/logger.ts";
import { emitToUsers } from "../lib/socket.ts";

const publicUserFields = "_id fullName email profilePic";

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

export const getFriendState = async (req: UserRequest, res: Response) => {
  try {
    const me = await User.findById(req.user?._id)
      .select("friends friendRequestsSent friendRequestsReceived blockedUsers")
      .populate("friends", publicUserFields)
      .populate("friendRequestsSent", publicUserFields)
      .populate("friendRequestsReceived", publicUserFields)
      .populate("blockedUsers", publicUserFields);

    if (!me) return res.status(404).json({ message: "User not found" });

    const friendState = {
      friends: me.friends,
      sentRequests: me.friendRequestsSent,
      receivedRequests: me.friendRequestsReceived,
      blockedUsers: me.blockedUsers,
    };

    res.status(200).json(friendState);
  } catch (error) {
    logger.error("Error in getFriendState: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const searchUsers = async (req: UserRequest, res: Response) => {
  try {
    const myId = req.user?._id;
    const query = String(req.query.fullName || "").trim();

    if (query.length < 2) {
      return res.status(200).json([]);
    }

    const me = await User.findById(myId).select(
      "friends friendRequestsSent friendRequestsReceived blockedUsers",
    );
    if (!me) return res.status(404).json({ message: "User not found" });

    const users = await User.find({
      _id: { $ne: myId },
      fullName: { $regex: query, $options: "i" },
      blockedUsers: { $ne: myId },
    })
      .select(publicUserFields)
      .limit(10);

    const ids = {
      friends: new Set(me.friends.map((id) => id.toString())),
      sent: new Set(me.friendRequestsSent.map((id) => id.toString())),
      received: new Set(me.friendRequestsReceived.map((id) => id.toString())),
      blocked: new Set(me.blockedUsers.map((id) => id.toString())),
    };

    const results = users.map((user) => {
      const userId = user._id.toString();
      let relationship = "none";
      if (ids.blocked.has(userId)) relationship = "blocked";
      else if (ids.friends.has(userId)) relationship = "friends";
      else if (ids.sent.has(userId)) relationship = "request_sent";
      else if (ids.received.has(userId)) relationship = "request_received";

      return { ...user.toObject(), relationship };
    });

    res.status(200).json(results);
  } catch (error) {
    logger.error("Error in searchUsers: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendFriendRequest = async (req: UserRequest, res: Response) => {
  try {
    const myId = req.user?._id?.toString();
    const { id: receiverId } = req.params;

    if (!myId || !isValidObjectId(receiverId) || myId === receiverId) {
      return res.status(400).json({ message: "Invalid user" });
    }

    const [me, receiver] = await Promise.all([
      User.findById(myId).select("fullName email profilePic friends friendRequestsSent friendRequestsReceived blockedUsers"),
      User.findById(receiverId).select("friends friendRequestsSent friendRequestsReceived blockedUsers"),
    ]);

    if (!me || !receiver) return res.status(404).json({ message: "User not found" });

    if (me.blockedUsers.some((id) => id.toString() === receiverId) ||
      receiver.blockedUsers.some((id) => id.toString() === myId)) {
      return res.status(403).json({ message: "You cannot send a request to this user" });
    }

    if (me.friends.some((id) => id.toString() === receiverId)) {
      return res.status(400).json({ message: "You are already friends" });
    }

    if (me.friendRequestsReceived.some((id) => id.toString() === receiverId)) {
      await Promise.all([
        User.findByIdAndUpdate(myId, {
          $addToSet: { friends: receiverId },
          $pull: { friendRequestsReceived: receiverId },
        }),
        User.findByIdAndUpdate(receiverId, {
          $addToSet: { friends: myId },
          $pull: { friendRequestsSent: myId },
        }),
      ]);

      emitToUsers([receiverId], "friendRequestAccepted", {
          user: {
            _id: me._id,
            fullName: me.fullName,
            email: me.email,
            profilePic: me.profilePic,
          },
        });

      return res.status(200).json({ message: "Friend request accepted" });
    }

    await Promise.all([
      User.findByIdAndUpdate(myId, { $addToSet: { friendRequestsSent: receiverId } }),
      User.findByIdAndUpdate(receiverId, { $addToSet: { friendRequestsReceived: myId } }),
    ]);

    emitToUsers([receiverId], "friendRequestReceived", {
        user: {
          _id: me._id,
          fullName: me.fullName,
          email: me.email,
          profilePic: me.profilePic,
        },
      });

    res.status(200).json({ message: "Friend request sent" });
  } catch (error) {
    logger.error("Error in sendFriendRequest: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const acceptFriendRequest = async (req: UserRequest, res: Response) => {
  try {
    const myId = req.user?._id?.toString();
    const { id: requesterId } = req.params;

    if (!myId || !isValidObjectId(requesterId)) {
      return res.status(400).json({ message: "Invalid user" });
    }

    const me = await User.findById(myId).select("fullName email profilePic friendRequestsReceived");
    if (!me) return res.status(404).json({ message: "User not found" });
    if (!me.friendRequestsReceived.some((id) => id.toString() === requesterId)) {
      return res.status(400).json({ message: "No pending request from this user" });
    }

    await Promise.all([
      User.findByIdAndUpdate(myId, {
        $addToSet: { friends: requesterId },
        $pull: { friendRequestsReceived: requesterId },
      }),
      User.findByIdAndUpdate(requesterId, {
        $addToSet: { friends: myId },
        $pull: { friendRequestsSent: myId },
      }),
    ]);

    emitToUsers([requesterId], "friendRequestAccepted", {
        user: {
          _id: me._id,
          fullName: me.fullName,
          email: me.email,
          profilePic: me.profilePic,
        },
      });

    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    logger.error("Error in acceptFriendRequest: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const declineFriendRequest = async (req: UserRequest, res: Response) => {
  try {
    const myId = req.user?._id?.toString();
    const { id: requesterId } = req.params;

    if (!myId || !isValidObjectId(requesterId)) {
      return res.status(400).json({ message: "Invalid user" });
    }

    await Promise.all([
      User.findByIdAndUpdate(myId, { $pull: { friendRequestsReceived: requesterId } }),
      User.findByIdAndUpdate(requesterId, { $pull: { friendRequestsSent: myId } }),
    ]);

    res.status(200).json({ message: "Friend request declined" });
  } catch (error) {
    logger.error("Error in declineFriendRequest: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const unfriendUser = async (req: UserRequest, res: Response) => {
  try {
    const myId = req.user?._id?.toString();
    const { id: friendId } = req.params;

    if (!myId || !isValidObjectId(friendId)) {
      return res.status(400).json({ message: "Invalid user" });
    }

    await Promise.all([
      User.findByIdAndUpdate(myId, { $pull: { friends: friendId } }),
      User.findByIdAndUpdate(friendId, { $pull: { friends: myId } }),
    ]);

    res.status(200).json({ message: "User unfriended" });
  } catch (error) {
    logger.error("Error in unfriendUser: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const blockUser = async (req: UserRequest, res: Response) => {
  try {
    const myId = req.user?._id?.toString();
    const { id: blockedId } = req.params;

    if (!myId || !isValidObjectId(blockedId) || myId === blockedId) {
      return res.status(400).json({ message: "Invalid user" });
    }

    await Promise.all([
      User.findByIdAndUpdate(myId, {
        $addToSet: { blockedUsers: blockedId },
        $pull: {
          friends: blockedId,
          friendRequestsSent: blockedId,
          friendRequestsReceived: blockedId,
        },
      }),
      User.findByIdAndUpdate(blockedId, {
        $pull: {
          friends: myId,
          friendRequestsSent: myId,
          friendRequestsReceived: myId,
        },
      }),
    ]);

    res.status(200).json({ message: "User blocked" });
  } catch (error) {
    logger.error("Error in blockUser: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const unblockUser = async (req: UserRequest, res: Response) => {
  try {
    const myId = req.user?._id?.toString();
    const { id: blockedId } = req.params;

    if (!myId || !isValidObjectId(blockedId)) {
      return res.status(400).json({ message: "Invalid user" });
    }

    await User.findByIdAndUpdate(myId, { $pull: { blockedUsers: blockedId } });
    res.status(200).json({ message: "User unblocked" });
  } catch (error) {
    logger.error("Error in unblockUser: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};
