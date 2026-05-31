import bcrypt from "bcrypt";
import { Response } from "express";
import User from "../database/users/userModel.ts";
import cloudinary from "../lib/cloudinary.ts";
import { generateToken } from "../lib/utils.ts";
import { UserRequest } from "../types/global.types.ts";
import logger from "../lib/logger.ts";

export const register = async (req: UserRequest, res: Response) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: "All fields are required!",
      });
    }
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }
    if (!/\d/.test(password)) {
      return res.status(400).json({
        message: "Password must contain at least one numeric value",
      });
    }
    if (!/[@#$!%*?&.]/.test(password)) {
      return res.status(400).json({
        message: "Password must contain at least one special symbol",
      });
    }

    const user = await User.findOne({ email });
    if (user)
      return res.status(400).json({
        message: "Email already exists!",
      });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Default profile picture if none provided
    // Using a public avatar service. 'username' style based on fullName without spaces.
    const defaultProfilePic = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`;

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      profilePic: defaultProfilePic,
    });
    if (newUser) {
      // generate jwt token here
      const token = generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        token,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    logger.error("Error on register controller : " + (error as Error).message);
    res.json({
      message: (error as Error).message,
    });
  }
};

export const login = async (req: UserRequest, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // logger.debug({ req: req.body });

    const token = generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      token,
    });
  } catch (error) {
    logger.error("Error in login controller " + (error as Error).message);
    res.json({
      message: (error as Error).message,
    });
  }
};

export const logout = (req: UserRequest, res: Response) => {
  try {
    res.cookie("jwt", process.env.JWT_SECRET || "", {
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Error in logout controller " + (error as Error).message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req: UserRequest, res: Response) => {
  try {
    const { profilePic, fullName, email } = req.body;
    const userId = req?.user?._id;

    if (!profilePic && !fullName && !email) {
      return res.status(400).json({ message: "Profile pic, name, or email is required" });
    }

    let uploadResponse;
    if (profilePic) {
      uploadResponse = await cloudinary.uploader.upload(profilePic);
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...(uploadResponse && { profilePic: uploadResponse.secure_url }),
        ...(fullName && { fullName }),
        ...(email && { email }),
      },
      { new: true },
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    logger.error("error in update profile: " + error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req: UserRequest, res: Response) => {
  try {
    // Generate a fresh token and include it in the response so the
    // frontend can persist it in sessionStorage after a page refresh.
    const token = generateToken(req.user!._id, res);
    res.status(200).json({ ...req.user!.toObject(), token });
  } catch (error) {
    logger.error("Error in checkAuth controller " + (error as Error).message);
    res.json({
      message: (error as Error).message,
    });
  }
};

export const deleteAccount = async (req: UserRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(400).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    logger.error("Error in deleteAccount controller: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};
