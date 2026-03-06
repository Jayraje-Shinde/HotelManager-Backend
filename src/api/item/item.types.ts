export interface BottleSizeInput {
	ml: number;          // e.g. 750
	price: number | null; // null = skip
}

export interface CreateLiquorInput {
	name: string;
	category_id: number;
	unit_id: number;
	code : string;
	gst_rate: number;    // always 0 for liquor — kept for API consistency
	vat_rate: number;    // Maharashtra VAT e.g. 10
	peg_price_per_ml : number;
	excise_rate : number;
	bottle_sizes: BottleSizeInput[];  // [{ml:750, price:600}, ...]
}

export interface CreateNonLiquorInput {
	name: string;
	category_id: number;
	unit_id: number;
	code : string;
	gst_rate: number;    // e.g. 5 for food, 18 for packaged beverages, 0 for no-tax
	vat_rate: number;    // always 0 for non-liquor
	selling_price: number;
	stock?: number;
}

export interface UpdateItemInput {
	name?: string;
	gst_rate?: number;
	vat_rate?: number;
	selling_price?: number;
	stock?: number | null;
	is_available?: boolean;
	manage_stock?: boolean;
}
