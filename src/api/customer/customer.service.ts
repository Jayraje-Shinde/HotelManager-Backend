import prisma from "../../config/db";

// ----------------------
// CREATE CUSTOMER
// ----------------------
export async function createCustomer(data: {
	name: string;
	phone?: string;
	address?: string;
}) {
	if (!data.name?.trim()) throw new Error("Customer name is required");

	return prisma.customer.create({
		data: {
			name: data.name.trim(),
			phone: data.phone?.trim() ?? null,
			address: data.address?.trim() ?? null
		}
	});
}

// ----------------------
// GET ALL CUSTOMERS
// ----------------------
export async function getAllCustomers() {
	return prisma.customer.findMany({
		orderBy: { id: "desc" },
		include: {
			_count: { select: { bills: true } }
		}
	});
}

// ----------------------
// GET CUSTOMER BY ID — with full bill + payment history
// ----------------------
export async function getCustomerById(id: number) {
	const customer = await prisma.customer.findUnique({
		where: { id },
		include: {
			bills: {
				include: {
					payments: true
				},
				orderBy: { bill_date: "desc" }
			}
		}
	});

	if (!customer) throw new Error("Customer not found");

	// Compute outstanding balance across all bills
	const totalBilled = customer.bills.reduce((sum, b) => sum + Number(b.total || 0), 0);
	const totalPaid   = customer.bills.reduce((sum, b) =>
		sum + b.payments.reduce((s, p) => s + Number(p.amount || 0), 0), 0
	);
	const outstanding = totalBilled - totalPaid;

	return {
		...customer,
		summary: {
			total_billed: totalBilled,
			total_paid: totalPaid,
			outstanding_balance: outstanding
		}
	};
}

// ----------------------
// UPDATE CUSTOMER
// ----------------------
export async function updateCustomer(
	id: number,
	data: { name?: string; phone?: string; address?: string }
) {
	const existing = await prisma.customer.findUnique({ where: { id } });
	if (!existing) throw new Error("Customer not found");

	return prisma.customer.update({
		where: { id },
		data: {
			name:    data.name?.trim()    ?? existing.name,
			phone:   data.phone?.trim()   ?? existing.phone,
			address: data.address?.trim() ?? existing.address
		}
	});
}

// ----------------------
// DELETE CUSTOMER
// ----------------------
export async function deleteCustomer(id: number) {
	const existing = await prisma.customer.findUnique({
		where: { id },
		include: { _count: { select: { bills: true } } }
	});
	if (!existing) throw new Error("Customer not found");
	if (existing._count.bills > 0)
		throw new Error("Cannot delete customer with linked bills");

	await prisma.customer.delete({ where: { id } });
	return { message: "Customer deleted successfully" };
}
