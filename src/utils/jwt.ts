import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev_secret_key";

export function signToken(payload: object) {
	return jwt.sign(payload, SECRET, { expiresIn: "1d" });
}

export function verifyToken(token: string) {
	return jwt.verify(token, SECRET);
}