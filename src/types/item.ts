export interface CreateItemInput {
	name: string;
	category_id: number;
	unit_id: number;
	selling_price: number;
	purchase_price: number;
	tax_rate?: number;
	stock?: number;
	is_available?: boolean;
	duty_per_unit?: number; // used only for liquor
}