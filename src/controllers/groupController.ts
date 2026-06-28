import { Response } from "express";
import mongoose from "mongoose";
import User from "../database/users/userModel.ts";
import Group from "../database/groups/groupModel.ts";
import GroupMessage from "../database/groups/groupMessageModel.ts";
import cloudinary from "../lib/cloudinary.ts";
import { getReceiverSocketIds, io } from "../lib/socket.ts";
import { UserRequest } from "../types/global.types.ts";
import logger from "../lib/logger.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MEMBER_FIELDS = "_id fullName profilePic email";
const ADMIN_FIELDS = "_id fullName profilePic";

async function getPopulatedGroup(groupId: string) {
  return Group.findById(groupId)
    .populate("members", MEMBER_FIELDS)
    .populate("admin", ADMIN_FIELDS);
}

function emitToMembers(
  memberIds: string[],
  event: string,
  payload: unknown,
  excludeId?: string,
) {
  for (const memberId of memberIds) {
    if (excludeId && memberId === excludeId) continue;
    const socketIds = getReceiverSocketIds(memberId);
    if (socketIds.length > 0) {
      io.to(socketIds).emit(event, payload);
    }
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

export const createGroup = async (req: UserRequest, res: Response) => {
  try {
    const { name, description, memberIds } = req.body as {
      name: string;
      description?: string;
      memberIds: string[];
    };
    const myId = req.user?._id.toString()!;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: "memberIds must be an array" });
    }

    // Load my friends once
    const me = await User.findById(myId).select("friends");
    if (!me) return res.status(404).json({ message: "User not found" });

    const myFriendIds = me.friends.map((id) => id.toString());

    // Validate each memberId
    for (const memberId of memberIds) {
      if (!mongoose.Types.ObjectId.isValid(memberId)) {
        return res.status(400).json({ message: `Invalid user id: ${memberId}` });
      }
      if (!myFriendIds.includes(memberId)) {
        return res
          .status(403)
          .json({ message: `User ${memberId} is not your friend` });
      }
    }

    // Deduplicate
    const dedupedMemberIds = [...new Set(memberIds)];

    const group = new Group({
      name: name.trim(),
      description: description ?? "",
      admin: myId,
      members: [myId, ...dedupedMemberIds],
    });

    await group.save();

    const populated = await getPopulatedGroup(group._id.toString());

    // Notify all members via socket
    const allMemberIds = [myId, ...dedupedMemberIds];
    emitToMembers(allMemberIds, "groupCreated", populated);

    return res.status(201).json(populated);
  } catch (error) {
    logger.error("Error in createGroup: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getMyGroups = async (req: UserRequest, res: Response) => {
  try {
    const myId = req.user?._id.toString()!;

    const groups = await Group.find({ members: myId })
      .populate("members", MEMBER_FIELDS)
      .populate("admin", ADMIN_FIELDS);

    return res.status(200).json(groups);
  } catch (error) {
    logger.error("Error in getMyGroups: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupMessages = async (req: UserRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const myId = req.user?._id.toString()!;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isMember = group.members.some((m) => m.toString() === myId);
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const messages = await GroupMessage.find({ groupId })
      .sort({ createdAt: 1 })
      .populate("senderId", MEMBER_FIELDS);

    return res.status(200).json(messages);
  } catch (error) {
    logger.error("Error in getGroupMessages: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const sendGroupMessage = async (req: UserRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const { text, image } = req.body as { text?: string; image?: string };
    const myId = req.user?._id.toString()!;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isMember = group.members.some((m) => m.toString() === myId);
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    let imageUrl: string | undefined;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new GroupMessage({
      groupId,
      senderId: myId,
      text,
      image: imageUrl,
    });

    await newMessage.save();
    await newMessage.populate("senderId", MEMBER_FIELDS);

    // Emit to all OTHER members
    const otherMemberIds = group.members
      .map((m) => m.toString())
      .filter((id) => id !== myId);
    emitToMembers(otherMemberIds, "newGroupMessage", newMessage);

    return res.status(201).json(newMessage);
  } catch (error) {
    logger.error("Error in sendGroupMessage: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const addGroupMember = async (req: UserRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body as { userId: string };
    const myId = req.user?._id.toString()!;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isMember = group.members.some((m) => m.toString() === myId);
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // Verify userId is a friend of current user
    const me = await User.findById(myId).select("friends");
    if (!me) return res.status(404).json({ message: "User not found" });

    const isFriend = me.friends.some((id) => id.toString() === userId);
    if (!isFriend) {
      return res.status(403).json({ message: "You can only add your friends to the group" });
    }

    // Check not already in group
    const alreadyMember = group.members.some((m) => m.toString() === userId);
    if (alreadyMember) {
      return res.status(409).json({ message: "User is already a member of this group" });
    }

    await Group.findByIdAndUpdate(groupId, { $push: { members: userId } });

    const populated = await getPopulatedGroup(groupId);
    const allMemberIds = (populated?.members as unknown as { _id: mongoose.Types.ObjectId }[])?.map(
      (m) => m._id.toString(),
    ) ?? [];

    emitToMembers(allMemberIds, "groupMemberAdded", { group: populated });

    return res.status(200).json(populated);
  } catch (error) {
    logger.error("Error in addGroupMember: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const removeGroupMember = async (req: UserRequest, res: Response) => {
  try {
    const { groupId, userId } = req.params;
    const myId = req.user?._id.toString()!;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const adminId = group.admin.toString();
    const isSelf = userId === myId;
    const isAdmin = adminId === myId;

    // Only admin can remove others; anyone can remove themselves
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: "Only admin can remove other members" });
    }

    const isMember = group.members.some((m) => m.toString() === userId);
    if (!isMember) {
      return res.status(404).json({ message: "User is not a member of this group" });
    }

    const remainingMembers = group.members
      .map((m) => m.toString())
      .filter((id) => id !== userId);

    // Last member leaving → delete group
    if (remainingMembers.length === 0) {
      await GroupMessage.deleteMany({ groupId });
      await Group.findByIdAndDelete(groupId);

      // Notify the leaving user's own sockets
      const socketIds = getReceiverSocketIds(userId);
      if (socketIds.length > 0) {
        io.to(socketIds).emit("groupDeleted", { groupId });
      }

      return res.status(200).json({ message: "Group deleted as no members remain" });
    }

    let newAdmin: string | undefined;

    // Admin is leaving and others remain → transfer admin
    if (isSelf && isAdmin && remainingMembers.length > 0) {
      newAdmin = remainingMembers[0];
      await Group.findByIdAndUpdate(groupId, { admin: newAdmin });
    }

    await Group.findByIdAndUpdate(groupId, { $pull: { members: userId } });

    // Emit to remaining members AND the removed user
    const notifyIds = [...remainingMembers, userId];
    emitToMembers(notifyIds, "groupMemberRemoved", { groupId, userId, newAdmin });

    return res.status(200).json({ message: "Member removed successfully" });
  } catch (error) {
    logger.error("Error in removeGroupMember: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const leaveGroup = async (req: UserRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const myId = req.user?._id.toString()!;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isMember = group.members.some((m) => m.toString() === myId);
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const adminId = group.admin.toString();
    const isAdmin = adminId === myId;

    const remainingMembers = group.members
      .map((m) => m.toString())
      .filter((id) => id !== myId);

    // Last member leaving → delete group
    if (remainingMembers.length === 0) {
      await GroupMessage.deleteMany({ groupId });
      await Group.findByIdAndDelete(groupId);

      const socketIds = getReceiverSocketIds(myId);
      if (socketIds.length > 0) {
        io.to(socketIds).emit("groupDeleted", { groupId });
      }

      return res.status(200).json({ message: "Group deleted as no members remain" });
    }

    let newAdmin: string | undefined;

    // Admin is leaving → transfer admin
    if (isAdmin && remainingMembers.length > 0) {
      newAdmin = remainingMembers[0];
      await Group.findByIdAndUpdate(groupId, { admin: newAdmin });
    }

    await Group.findByIdAndUpdate(groupId, { $pull: { members: myId } });

    const notifyIds = [...remainingMembers, myId];
    emitToMembers(notifyIds, "groupMemberRemoved", { groupId, userId: myId, newAdmin });

    return res.status(200).json({ message: "Left the group successfully" });
  } catch (error) {
    logger.error("Error in leaveGroup: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateGroup = async (req: UserRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const { name, description, avatar } = req.body as {
      name?: string;
      description?: string;
      avatar?: string;
    };
    const myId = req.user?._id.toString()!;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() !== myId) {
      return res.status(403).json({ message: "Only admin can update the group" });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (avatar !== undefined) updates.avatar = avatar;

    const updated = await Group.findByIdAndUpdate(groupId, updates, { new: true })
      .populate("members", MEMBER_FIELDS)
      .populate("admin", ADMIN_FIELDS);

    const memberIds = group.members.map((m) => m.toString());
    emitToMembers(memberIds, "groupUpdated", updated);

    return res.status(200).json(updated);
  } catch (error) {
    logger.error("Error in updateGroup: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteGroup = async (req: UserRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const myId = req.user?._id.toString()!;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (group.admin.toString() !== myId) {
      return res.status(403).json({ message: "Only admin can delete the group" });
    }

    const memberIds = group.members.map((m) => m.toString());

    await GroupMessage.deleteMany({ groupId });
    await Group.findByIdAndDelete(groupId);

    emitToMembers(memberIds, "groupDeleted", { groupId });

    return res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    logger.error("Error in deleteGroup: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const editGroupMessage = async (req: UserRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body as { text: string };
    const myId = req.user?._id.toString()!;

    const message = await GroupMessage.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.senderId.toString() !== myId) {
      return res.status(403).json({ message: "Unauthorized to edit this message" });
    }

    message.text = text;
    message.isEdited = true;
    await message.save();
    await message.populate("senderId", MEMBER_FIELDS);

    const group = await Group.findById(message.groupId);
    if (group) {
      const otherMemberIds = group.members
        .map((m) => m.toString())
        .filter((id) => id !== myId);
      emitToMembers(otherMemberIds, "groupMessageEdited", message);
    }

    return res.status(200).json(message);
  } catch (error) {
    logger.error("Error in editGroupMessage: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteGroupMessage = async (req: UserRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const myId = req.user?._id.toString()!;

    const message = await GroupMessage.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.senderId.toString() !== myId) {
      return res.status(403).json({ message: "Unauthorized to delete this message" });
    }

    const groupId = message.groupId.toString();

    const group = await Group.findById(groupId);

    await GroupMessage.findByIdAndDelete(messageId);

    if (group) {
      const otherMemberIds = group.members
        .map((m) => m.toString())
        .filter((id) => id !== myId);
      emitToMembers(otherMemberIds, "groupMessageDeleted", { groupId, messageId });
    }

    return res.status(200).json({ message: "Message deleted successfully", messageId });
  } catch (error) {
    logger.error("Error in deleteGroupMessage: " + (error as Error).message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
