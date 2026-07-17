import { NextFunction, Request, Response } from "express";
import logger from "../lib/logger.ts";
import { env } from "../config/env.ts";

interface HttpError extends Error {
    statusCode?: number;
}

const isHttpError = (err: unknown): err is HttpError => {
    return err instanceof Error;
};

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const error: HttpError = isHttpError(err) ? err : new Error(String(err));

    logger.error("Error Detail: " + (error.stack || error.message));

    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    res.status(statusCode).json({
        success: false,
        message,
        ...(env.NODE_ENV === "development" && { stack: error.stack }),
    });
};
