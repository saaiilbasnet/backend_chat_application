import type { Response } from "express";
import jwt from "jsonwebtoken";
import type { Types } from "mongoose";
import { env } from "../config/env.ts";

type JwtUserId = string | Types.ObjectId;

export const generateToken = (userId: JwtUserId, res: Response) => {
  const token = jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, 
    httpOnly: true, 
    sameSite: process.env.NODE_ENV !== "development" ? "none" : "strict",
    secure: process.env.NODE_ENV !== "development",
  });

  return token;
};
