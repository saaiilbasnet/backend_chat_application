import User from "../database/users/userModel.ts";
import Message from "../database/messages/messageModel.ts";

import cloudinary from "../lib/cloudinary.ts";
import { getReceiverSocketIds, io } from "../lib/socket.ts";
import { UserRequest } from "../types/global.types.ts";
import { Response } from "express";
import logger from "../lib/logger.ts";

export const getUsersForSidebar = async (req: UserRequest, res: Response) => {
  try {
    const loggedInUserId = req?.user?._id;
    const me = await User.findById(loggedInUserId).select("friends blockedUsers");
    if (!me) return res.status(404).json({ message: "User not found" });

    const filteredUsers = await User.find({
      _id: { $in: me.friends, $nin: me.blockedUsers },
      blockedUsers: { $ne: loggedInUserId },
    }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    logger.error("Error in getUsersForSidebar: " + (error as Error).message);
    res.json({ error: (error as Error) });
  }
};

export const getMessages = async (req: UserRequest, res: Response) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req?.user?._id;
    const [me, userToChat] = await Promise.all([
      User.findById(myId).select("friends blockedUsers"),
      User.findById(userToChatId).select("blockedUsers"),
    ]);

    if (!me || !userToChat) {
      return res.status(404).json({ message: "User not found" });
    }

    const isFriend = me.friends.some((id) => id.toString() === userToChatId);
    const isBlocked = me.blockedUsers.some((id) => id.toString() === userToChatId) ||
      userToChat.blockedUsers.some((id) => id.toString() === myId?.toString());

    if (!isFriend || isBlocked) {
      return res.status(403).json({ message: "You can only message accepted friends" });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
      deletedBy: { $ne: myId },
    });

    res.status(200).json(messages);
  } catch (error) {
    logger.error("Error in getMessages controller: " + (error as Error).message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req: UserRequest, res: Response) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req?.user?._id;
    const [sender, receiver] = await Promise.all([
      User.findById(senderId).select("friends blockedUsers"),
      User.findById(receiverId).select("blockedUsers"),
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    const isFriend = sender.friends.some((id) => id.toString() === receiverId);
    const isBlocked = sender.blockedUsers.some((id) => id.toString() === receiverId) ||
      receiver.blockedUsers.some((id) => id.toString() === senderId?.toString());

    if (!isFriend || isBlocked) {
      return res.status(403).json({ message: "You can only message accepted friends" });
    }

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    const receiverSocketIds = getReceiverSocketIds(receiverId);
    if (receiverSocketIds.length > 0) {
      io.to(receiverSocketIds).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    logger.error("Error in sendMessage controller: " + (error as Error).message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteChat = async (req: UserRequest, res: Response) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req?.user?._id;

    await Message.updateMany(
      {
        $or: [
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId },
        ],
      },
      { $addToSet: { deletedBy: myId } },
    );

    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    logger.error("Error in deleteChat controller: " + (error as Error).message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const editMessage = async (req: UserRequest, res: Response) => {
  try {
    const { id: messageId } = req.params;
    const { text } = req.body;
    const myId = req?.user?._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId.toString() !== myId?.toString()) {
      return res.status(403).json({ error: "Unauthorized to edit this message" });
    }

    message.text = text;
    message.isEdited = true;
    await message.save();

    const receiverSocketIds = getReceiverSocketIds(message.receiverId.toString());
    if (receiverSocketIds.length > 0) {
      io.to(receiverSocketIds).emit("messageEdited", message);
    }

    res.status(200).json(message);
  } catch (error) {
    logger.error("Error in editMessage controller: " + (error as Error).message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteSingleMessage = async (req: UserRequest, res: Response) => {
  try {
    const { id: messageId } = req.params;
    const myId = req?.user?._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId.toString() !== myId?.toString()) {
      return res.status(403).json({ error: "Unauthorized to delete this message" });
    }

    const receiverId = message.receiverId.toString();

    // Hard delete the message
    await Message.findByIdAndDelete(messageId);

    const receiverSocketIds = getReceiverSocketIds(receiverId);
    if (receiverSocketIds.length > 0) {
      io.to(receiverSocketIds).emit("messageDeleted", messageId);
    }

    res.status(200).json({ message: "Message deleted successfully", messageId });
  } catch (error) {
    logger.error("Error in deleteSingleMessage controller: " + (error as Error).message);
    res.status(500).json({ error: "Internal server error" });
  }
};
