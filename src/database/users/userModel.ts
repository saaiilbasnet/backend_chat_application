import mongoose, { type HydratedDocument, type Types } from "mongoose";

export interface IUser {
  email: string;
  fullName: string;
  password: string;
  profilePic: string;
  friends: Types.ObjectId[];
  friendRequestsSent: Types.ObjectId[];
  friendRequestsReceived: Types.ObjectId[];
  blockedUsers: Types.ObjectId[];
  isVerified: boolean;
  otp?: string;
  otpExpiresAt?: Date;
  otpResendCount: number;
  otpLastSentAt?: Date;
  passwordResetOtp?: string;
  passwordResetOtpExpiresAt?: Date;
  passwordResetOtpLastSentAt?: Date;
  passwordResetOtpResendCount: number;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new mongoose.Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    profilePic: {
      type: String,
      default: "https://api.dicebear.com/7.x/initials/svg?seed=User",
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequestsSent: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequestsReceived: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpiresAt: {
      type: Date,
    },
    otpResendCount: {
      type: Number,
      default: 0,
    },
    otpLastSentAt: {
      type: Date,
    },
    passwordResetOtp: {
      type: String,
    },
    passwordResetOtpExpiresAt: {
      type: Date,
    },
    passwordResetOtpLastSentAt: {
      type: Date,
    },
    passwordResetOtpResendCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
