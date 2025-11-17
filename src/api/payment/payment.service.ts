import prisma from "../../config/db";
import { CreatePaymentInput } from "./payment.types";

export async function addPayment(billId: number, data: CreatePaymentInput) {
	const bill = await prisma.bill.findUnique({
		where: { id: billId },
		include: { payments: true, items: true }
	});

	if (!bill) throw new Error("bill_not_found");

	// Payment allowed ONLY when bill is CLOSED
	if (bill.status !== "CLOSED") {
		throw new Error("bill_not_closed_payment_not_allowed");
	}



	// Create payment record
	const createdPayment = await prisma.payment.create({
		data: {
			billId,
			method: data.method,
			amount: data.amount,
			referenceNo: data.referenceNo ?? null
		}
	});

	// calculate total paid
	const totalPaid =
		bill.payments.reduce((sum, p) => sum + p.amount, 0) +
		createdPayment.amount;

	if (totalPaid >= bill.total) {
		// fully paid
		await prisma.bill.update({
			where: { id: billId },
			data: { status: "PAID" }
		});

		// free the table
		await prisma.tableStatus.updateMany({
			where: { current_bill_id: billId },
			data: { status: "VACANT", current_bill_id: null }
		});
	}

	return createdPayment;
}
