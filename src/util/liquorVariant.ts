import prisma from "../config/db";

const VARIANT_SIZES = [30, 60, 90, 180, 375];

export async function createLiquorVariants(parent: {
	id: number;
	name: string;
	category_id: number;
	unit_id: number;
	purchase_price: number;
	ml_per_unit: number;

	price_30ml?: number | null;
	price_60ml?: number | null;
	price_90ml?: number | null;
	price_180ml?: number | null;
	price_375ml?: number | null;
}) {
	const pricePerML = parent.purchase_price / parent.ml_per_unit;

	const customMap: Record<number, number | null | undefined> = {
		30: parent.price_30ml,
		60: parent.price_60ml,
		90: parent.price_90ml,
		180: parent.price_180ml,
		375: parent.price_375ml
	};

	for (const ml of VARIANT_SIZES) {
		if (ml >= parent.ml_per_unit) continue; // cannot exceed bottle volume

		const custom = customMap[ml];
		const autoPrice = Math.round(pricePerML * ml);
		const sellingPrice = typeof custom === "number" ? custom : autoPrice;

		await prisma.item.create({
			data: {
				name: `${parent.name} ${ml}ml`,
				category_id: parent.category_id,
				unit_id: parent.unit_id,
				tax_rate: 0,
				selling_price: sellingPrice,
				purchase_price: 0,
				stock: 0,
				is_available: true,
				manage_stock: false,     // variants DO NOT manage stock
				is_liquor: true,
				ml_per_unit: null,
				variant_ml: ml,
				parent_id: parent.id,

				price_30ml: null,
				price_60ml: null,
				price_90ml: null,
				price_180ml: null,
				price_375ml: null
			}
		});
	}
}
