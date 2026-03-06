import prisma from "../../config/db";
import { Prisma } from "@prisma/client";

const EPSILON = 0.01;

/* ============================================================
   CREATE BILL
============================================================ */
export async function createBill(tableNo: string) {
	if (!tableNo) throw new Error("table_required");

	const existing = await prisma.bill.findFirst({
		where: { table_no: tableNo, status: "OPEN" }
	});
	if (existing) return existing;

	const bill = await prisma.bill.create({
		data: { table_no: tableNo, status: "OPEN", total: 0, discount: 0 }
	});

	await prisma.tableStatus.upsert({
		where:  { table_no: tableNo },
		update: { status: "OCCUPIED", current_bill_id: bill.id },
		create: { table_no: tableNo, zone: "", status: "OCCUPIED", current_bill_id: bill.id }
	});

	return bill;
}

/* ============================================================
   CLOSE BILL
============================================================ */
export async function closeBill(billId: number) {
	return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const bill = await tx.bill.findUnique({
			where:   { id: billId },
			include: { kots: true }
		});

		if (!bill) throw new Error("bill_not_found");
		if (bill.status !== "OPEN") throw new Error("invalid_state");

		const openKOT = bill.kots.find((k) => k.status !== "CLOSED" && k.status !== "CANCELLED");
		if (openKOT) throw new Error("kot_not_closed");

		await tx.bill.update({
			where: { id: bill.id },
			data:  { status: "CLOSED" }
		});

		await tx.tableStatus.updateMany({
			where: { table_no: bill.table_no },
			data:  { status: "BILLED" }
		});

		return { success: true };
	});
}

/* ============================================================
   ADD PAYMENT TO BILL (supports partial / credit / udhar)
============================================================ */
export async function addPaymentToBill(
	billId:   number,
	payments: { method: any; amount: number }[]
) {
	return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const bill = await tx.bill.findUnique({
			where:   { id: billId },
			include: { payments: true }
		});

		if (!bill) throw new Error("bill_not_found");
		if (bill.status !== "CLOSED" && bill.status !== "CREDIT")
			throw new Error("bill_not_closed");

		const existing = bill.payments.reduce((s, p) => s + p.amount, 0);
		const incoming = payments.reduce((s, p) => s + p.amount, 0);
		const billTotal = bill.total - (bill.discount ?? 0);

		if (existing + incoming > billTotal + EPSILON)
			throw new Error("overpayment");

		for (const p of payments) {
			await tx.payment.create({
				data: { billId: bill.id, method: p.method, amount: p.amount }
			});
		}

		const totalPaid = existing + incoming;
		const isFullyPaid = totalPaid >= billTotal - EPSILON;

		if (isFullyPaid) {
			await tx.bill.update({
				where: { id: bill.id },
				data:  { status: "PAID" }
			});
			await tx.tableStatus.updateMany({
				where: { table_no: bill.table_no },
				data:  { status: "VACANT", current_bill_id: null }
			});
		}

		return {
			success:     true,
			total_paid:  totalPaid,
			outstanding: Math.max(0, billTotal - totalPaid),
			fully_paid:  isFullyPaid
		};
	});
}

/* ============================================================
   MARK BILL AS CREDIT (udhar — no payment now)
============================================================ */
export async function markBillAsCredit(
	billId:     number,
	customerId: number
) {
	const bill = await prisma.bill.findUnique({
		where:   { id: billId },
		include: { payments: true }
	});

	if (!bill)                      throw new Error("bill_not_found");
	if (bill.status !== "CLOSED")   throw new Error("bill_must_be_closed_first");

	const customer = await prisma.customer.findUnique({ where: { id: customerId } });
	if (!customer) throw new Error("customer_not_found");

	const updated = await prisma.bill.update({
		where:   { id: billId },
		data:    { status: "CREDIT", customer_id: customerId },
		include: { customer: true, payments: true }
	});

	// Table is now free
	await prisma.tableStatus.updateMany({
		where: { table_no: bill.table_no },
		data:  { status: "VACANT", current_bill_id: null }
	});

	return updated;
}

/* ============================================================
   ASSIGN CUSTOMER TO BILL
============================================================ */
export async function assignCustomerToBill(billId: number, customerId: number) {
	const bill = await prisma.bill.findUnique({ where: { id: billId } });
	if (!bill) throw new Error("bill_not_found");

	const customer = await prisma.customer.findUnique({ where: { id: customerId } });
	if (!customer) throw new Error("customer_not_found");

	return prisma.bill.update({
		where:   { id: billId },
		data:    { customer_id: customerId },
		include: { customer: true }
	});
}

/* ============================================================
   GET ALL OPEN / CLOSED BILLS
============================================================ */
export async function getAllBillsOpen() {
	return prisma.bill.findMany({
		where:   { status: { in: ["OPEN", "CLOSED", "CREDIT"] } },
		include: { customer: true },
		orderBy: { id: "desc" }
	});
}
export async function getAllBills() {
	return prisma.bill.findMany();
}

/* ============================================================
   GET BILL BY ID
============================================================ */
export async function findBillByID(billid: number) {
	const bill = await prisma.bill.findUnique({
		where: { id: billid },
		include: {
			user: {
				select: { id: true, name: true, waitercode: true, role: true }
			},
			items: {
				include: { item: true }
			},
			payments: true,
			customer: true
		}
	});

	if (!bill) return null;

	const totalPaid   = bill.payments.reduce((s, p) => s + p.amount, 0);
	const billTotal   = bill.total - (bill.discount ?? 0);
	const outstanding = Math.max(0, billTotal - totalPaid);

	return { ...bill, total_paid: totalPaid, outstanding };
}

/* ============================================================
   ASSIGN WAITER TO BILL
============================================================ */
export async function assignWaiterTobill(billid: number, waiterID: number) {
	return prisma.bill.update({
		where: { id: billid },
		data:  { user_id: waiterID }
	});
}
