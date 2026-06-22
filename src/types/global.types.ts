import type { Request } from "express";

export interface UserRequest extends Request {
  user?: {
    _id: string;
    fullName: string;
    email: string;
    profilePic: string;
    friends?: string[];
    friendRequestsSent?: string[];
    friendRequestsReceived?: string[];
    blockedUsers?: string[];
  };
}

export type UserIdType = string;
