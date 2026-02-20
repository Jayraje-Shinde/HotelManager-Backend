import prisma from "../../config/db";
import { Prisma } from "@prisma/client";

const EPSILON = 0.01;

export async function closeBill(billId: number) {
	return prisma.$transaction(async (tx: Prisma.TransactionClient) => {

		const bill = await tx.bill.findUnique({
			where: { id: billId },
			include: { kots: true }
		});

		if (!bill) throw new Error("bill_not_found");
		if (bill.status !== "OPEN") throw new Error("invalid_state");

		const openKOT = bill.kots.find(k => k.status !== "CLOSED");
		if (openKOT) throw new Error("kot_not_closed");

		await tx.bill.update({
			where: { id: bill.id },
			data: { status: "CLOSED" }
		});

		await tx.tableStatus.updateMany({
			where: { table_no: bill.table_no },
			data: { status: "BILLED" }
		});

		return { success: true };
	});
}

export async function addPaymentToBill(
	billId: number,
	payments: { method: any; amount: number }[]
) {
	return prisma.$transaction(async (tx: Prisma.TransactionClient) => {

		const bill = await tx.bill.findUnique({
			where: { id: billId },
			include: { payments: true }
		});

		if (!bill) throw new Error("bill_not_found");
		if (bill.status !== "CLOSED")
			throw new Error("bill_not_closed");

		const existing = bill.payments.reduce((s, p) => s + p.amount, 0);
		const incoming = payments.reduce((s, p) => s + p.amount, 0);

		if (existing + incoming - bill.total > EPSILON)
			throw new Error("overpayment");

		for (const p of payments) {
			await tx.payment.create({
				data: {
					billId: bill.id,
					method: p.method,
					amount: p.amount
				}
			});
		}

		if (existing + incoming >= bill.total - EPSILON) {
			await tx.bill.update({
				where: { id: bill.id },
				data: { status: "PAID" }
			});

			await tx.tableStatus.updateMany({
				where: { table_no: bill.table_no },
				data: { status: "VACANT", current_bill_id: null }
			});
		}

		return { success: true };
	});
}

export async function getAllBills() {
	return prisma.bill.findMany({
		where: {
			status: {
				in: ["CLOSED", "OPEN"]
			}
		}
	});
}

export async function createBill(tableNo: string) {

	if (!tableNo) throw new Error("table_required");

	// Check if already open bill exists
	const existing = await prisma.bill.findFirst({
		where: {
			table_no: tableNo,
			status: "OPEN"
		}
	});

	if (existing) return existing;

	const bill = await prisma.bill.create({
		data: {
			table_no: tableNo,
			status: "OPEN",
			total: 0,
			discount: 0
		}
	});

	// Mark table occupied
	await prisma.tableStatus.upsert({
		where: { table_no: tableNo },
		update: {
			status: "OCCUPIED",
			current_bill_id: bill.id
		},
		create: {
			table_no: tableNo,
			zone: "",
			status: "OCCUPIED",
			current_bill_id: bill.id
		}
	});

	return bill;
}

export async function findBillByID(billid: number) {
	const bill = await prisma.bill.findUnique({
		where: {
			id: billid
		},
		include: {
			user: {
				select: {
					id: true,
					name: true,
					waitercode: true,
					role : true
				}
			},
			items: {
				include: {
					item: true
				}
			}
		}
	})
	return bill;
}

export async function assignWaiterTobill(billid: number, waiterID: number) {
	const assigned = await prisma.bill.update({
		where: { id: billid },
		data: {
			user_id: waiterID
		}
	});
	return assigned;
}

