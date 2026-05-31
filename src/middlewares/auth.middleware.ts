import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../database/users/userModel.ts";
import { NextFunction, Response } from "express";
import { UserRequest } from "../types/global.types.ts";
import logger from "../lib/logger.ts";

export const protectRoute = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawToken = req.headers.authorization?.split(" ")[1] || req.cookies.jwt;

    // Guard against the frontend sending the literal string "undefined" or "null"
    const token = rawToken && rawToken !== "undefined" && rawToken !== "null"
      ? rawToken
      : null;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No Token Provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as JwtPayload;

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user as unknown as NonNullable<UserRequest["user"]>;

    next();
  } catch (error) {
    logger.error("Error in protectRoute middleware: " + (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};
