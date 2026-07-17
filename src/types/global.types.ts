import type { Request } from "express";
import type { UserDocument } from "../database/users/userModel.ts";

export interface UserRequest extends Request {
  user?: UserDocument;
}

export type UserIdType = string;
