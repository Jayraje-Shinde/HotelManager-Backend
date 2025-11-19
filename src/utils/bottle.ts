import prisma from "../config/db";
import { audit } from "./audit";
import { AuditEvent } from "./auditEvents";

/**
 * Checks if the bottle is fully consumed and automatically marks FINISHED.
 * Also triggers an audit event.
 */
export async function autoFinishBottle(bottleId: number, userId?: number) {
	const bottle = await prisma.openLiquorBottle.findUnique({
		where: { id: bottleId }
	});

	if (!bottle) throw new Error("Bottle not found");

	// Already finished or closed — no action needed
	if (bottle.status !== "OPEN") return;

	// Not empty → nothing to do
	if (bottle.ml_remaining > 0) return;

	// ml_remaining == 0 → Finish it
	await prisma.openLiquorBottle.update({
		where: { id: bottleId },
		data: {
			status: "FINISHED",
			closed_at: new Date()
		}
	});

	// Audit log
	await audit(
		userId ?? null,
		AuditEvent.BOTTLE_FINISH,
		`Bottle #${bottleId} finished (0ml remaining)`
	);
}
