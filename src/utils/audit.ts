import prisma from "../config/db";
export async function audit(
	user_id: number | null,
	action: string,
	description: string = "",
	ip: string | null = null
) {
	try {
		await prisma.auditlog.create({
			data: {
				user_id,
				action,
				description,
				ip
			}
		});
	} catch (err) {
		console.warn("AUDIT LOG FAILED:", err);
	}
}
