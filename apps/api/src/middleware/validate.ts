import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

export function validateBody(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
    }
    req.query = parsed.data as unknown as Request["query"];
    next();
  };
}
