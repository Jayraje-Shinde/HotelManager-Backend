import { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
		  const body = JSON.stringify(req.body)
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)  (${body})`);
    });
    next();
}