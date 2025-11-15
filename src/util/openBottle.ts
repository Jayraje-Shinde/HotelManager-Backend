import prisma from "../config/db";

export async function breakBottle(parentItemId: number) {
	const parent = await prisma.item.findUnique({ where: { id: parentItemId } });
	if (!parent) throw new Error("Parent bottle item not found");
	if (!parent.ml_per_unit) throw new Error("Bottle has no ml_per_unit");

	if ((parent.stock ?? 0) <= 0)
		throw new Error("No full bottles available");

	await prisma.item.update({
		where: { id: parentItemId },
		data: { stock: (parent.stock ?? 0) - 1 }
	});

	return prisma.openLiquorBottle.create({
		data: {
			item_id: parentItemId,
			ml_remaining: parent.ml_per_unit,
			status: "open"
		}
	});
}

export async function serveFromBottle(parentItemId: number, qtyMl: number) {
	let remaining = qtyMl;

	let bottle = await prisma.openLiquorBottle.findFirst({
		where: { item_id: parentItemId, status: "open" },
		orderBy: { opened_at: "asc" }
	});

	if (!bottle) bottle = await breakBottle(parentItemId);

	while (remaining > 0) {
		bottle = await prisma.openLiquorBottle.findUnique({ where: { id: bottle.id } });
		if (!bottle) throw new Error("Bottle disappeared");

		if (bottle.ml_remaining <= 0) {
			await prisma.openLiquorBottle.update({
				where: { id: bottle.id },
				data: { status: "finished", ml_remaining: 0 }
			});
			bottle = await breakBottle(parentItemId);
			continue;
		}

		const serveNow = Math.min(bottle.ml_remaining, remaining);

		await prisma.openLiquorBottle.update({
			where: { id: bottle.id },
			data: { ml_remaining: bottle.ml_remaining - serveNow }
		});

		remaining -= serveNow;

		if (bottle.ml_remaining - serveNow <= 0) {
			await prisma.openLiquorBottle.update({
				where: { id: bottle.id },
				data: { status: "finished", ml_remaining: 0 }
			});
		}
	}

	return { served_ml: qtyMl };
}
