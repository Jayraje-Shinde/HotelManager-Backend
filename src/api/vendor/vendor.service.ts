import prisma from "../../config/db";
import { vendorType } from '../../types/vendor'


export async function createVendor(data: vendorType) {
	const name = data.name.trim().toLowerCase();

	return prisma.vendor.create({
		data: {
			name,
			contact: data.contact,
			license_no: data.license_no,
			type: data.type
		}
	});
}

export async function getAllVendors() {
	return prisma.vendor.findMany({
		orderBy: { id: "asc" }
	});
}

export async function deleteVendor(id: number) {
	const vendor = await prisma.vendor.findUnique({
		where: { id },
		include: { purchases: true }
	});

	if (!vendor) throw new Error("Vendor not found");

	if (vendor.purchases.length > 0)
		throw new Error("Cannot delete vendor with linked purchases");

	await prisma.vendor.delete({ where: { id } });

	return { message: "Vendor deleted successfully" };
}
