export interface BottleSizeInput {
	ml: number;          // e.g. 750
	price: number | null; // null = skip
}

export interface CreateLiquorInput {
	name: string;
	category_id: number;
	unit_id: number;
	tax_rate: number;
	peg_price_per_ml : number;
	excise_rate : number;
	bottle_sizes: BottleSizeInput[];  // [{ml:750, price:600}, ...]
}

export interface CreateNonLiquorInput {
	name: string;
	category_id: number;
	unit_id: number;
	tax_rate: number;
	selling_price: number;
	stock?: number;
}

export interface UpdateItemInput {
	name?: string;
	tax_rate?: number;
	selling_price?: number;
	stock?: number | null;
	is_available?: boolean;
	manage_stock?: boolean,
}
