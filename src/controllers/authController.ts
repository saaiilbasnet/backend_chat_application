import bcrypt from "bcrypt";
import { Response } from "express";
import User from "../database/users/userModel.ts";
import cloudinary from "../lib/cloudinary.ts";
import { generateToken } from "../lib/utils.ts";
import { UserRequest } from "../types/global.types.ts";
import logger from "../lib/logger.ts";
import { enqueueEmail } from "../lib/queues.ts";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const validatePassword = (password: string) => {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/\d/.test(password)) return "Password must contain at least one numeric value";
  if (!/[@#$!%*?&.]/.test(password)) return "Password must contain at least one special symbol";
  return null;
};

const getOtpWaitMs = (count: number) => {
  if (count === 1) return 120 * 1000;
  if (count >= 2) return 300 * 1000;
  return 30 * 1000;
};

export const register = async (req: UserRequest, res: Response) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: "All fields are required!",
      });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    let user = await User.findOne({ email });
    if (user) {
      if (user.isVerified) {
        return res.status(400).json({ message: "Email already exists!" });
      }
      // If unverified, we'll update their OTP and resend
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOTP();
    const now = Date.now();
    const otpExpiresAt = new Date(now + 10 * 60 * 1000); // 10 minutes

    if (!user) {
      const defaultProfilePic = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`;
      user = new User({
        fullName,
        email,
        password: hashedPassword,
        profilePic: defaultProfilePic,
        isVerified: false,
        otp,
        otpExpiresAt,
        otpLastSentAt: new Date(now),
        otpResendCount: 0,
      });
    } else {
      user.fullName = fullName;
      user.password = hashedPassword;
      user.otp = otp;
      user.otpExpiresAt = otpExpiresAt;
      user.otpLastSentAt = new Date(now);
      user.otpResendCount = 0;
    }

    await user.save();

    await enqueueEmail({
      to: email,
      subject: "Your OTP for Zeno Chat Verification",
      html: `<p>Your verification code is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`,
    });

    res.status(200).json({
      message: "OTP sent to your email",
      requireOtp: true,
      email: user.email,
    });

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

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email first", unverified: true });
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
    res.cookie("jwt", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: process.env.NODE_ENV !== "development" ? "none" : "strict",
      secure: process.env.NODE_ENV !== "development",
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
    const user = req.user as typeof req.user & { toObject?: () => object };
    const safeUser = user?.toObject ? user.toObject() : user;
    res.status(200).json({ ...safeUser, token });
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

export const verifyOtp = async (req: UserRequest, res: Response) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (!user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.otpLastSentAt = undefined;
    user.otpResendCount = 0;
    await user.save();

    const token = generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      token,
    });
  } catch (error) {
    logger.error("Error in verifyOtp controller: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resendOtp = async (req: UserRequest, res: Response) => {
  const { email } = req.body;
  try {
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "Email is already verified" });

    const now = Date.now();
    if (user.otpLastSentAt) {
      const timeSinceLastSent = now - user.otpLastSentAt.getTime();
      const count = user.otpResendCount || 0;
      
      const requiredWaitMs = getOtpWaitMs(count);

      if (timeSinceLastSent < requiredWaitMs) {
        const remainingSeconds = Math.ceil((requiredWaitMs - timeSinceLastSent) / 1000);
        return res.status(429).json({ message: `Please wait ${remainingSeconds} seconds before requesting another OTP`, remainingSeconds });
      }
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiresAt = new Date(now + 10 * 60 * 1000);
    user.otpLastSentAt = new Date(now);
    user.otpResendCount = (user.otpResendCount || 0) + 1;
    await user.save();

    await enqueueEmail({
      to: email,
      subject: "Your new OTP for Zeno Chat Verification",
      html: `<p>Your new verification code is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`,
    });

    res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    logger.error("Error in resendOtp controller: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPassword = async (req: UserRequest, res: Response) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  try {
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        message: "If an account exists for this email, a reset OTP will be sent.",
        email,
      });
    }

    const now = Date.now();
    if (user.passwordResetOtpLastSentAt) {
      const timeSinceLastSent = now - user.passwordResetOtpLastSentAt.getTime();
      const count = user.passwordResetOtpResendCount || 0;
      const requiredWaitMs = getOtpWaitMs(count);

      if (timeSinceLastSent < requiredWaitMs) {
        const remainingSeconds = Math.ceil((requiredWaitMs - timeSinceLastSent) / 1000);
        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before requesting another OTP`,
          remainingSeconds,
        });
      }
    }

    const otp = generateOTP();
    user.passwordResetOtp = otp;
    user.passwordResetOtpExpiresAt = new Date(now + 10 * 60 * 1000);
    user.passwordResetOtpLastSentAt = new Date(now);
    user.passwordResetOtpResendCount = (user.passwordResetOtpResendCount || 0) + 1;
    await user.save();

    await enqueueEmail({
      to: email,
      subject: "Your Zeno password reset OTP",
      html: `<p>Your password reset code is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`,
    });

    return res.status(200).json({ message: "Password reset OTP sent to your email", email });
  } catch (error) {
    logger.error("Error in forgotPassword controller: " + (error as Error).message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req: UserRequest, res: Response) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const { otp, password } = req.body;
  try {
    if (!email || !otp || !password) {
      return res.status(400).json({ message: "Email, OTP, and password are required" });
    }

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.passwordResetOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (!user.passwordResetOtpExpiresAt || user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    user.passwordResetOtpLastSentAt = undefined;
    user.passwordResetOtpResendCount = 0;
    await user.save();

    const token = generateToken(user._id, res);

    return res.status(200).json({
      message: "Password reset successfully",
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      token,
    });
  } catch (error) {
    logger.error("Error in resetPassword controller: " + (error as Error).message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
