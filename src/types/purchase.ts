export interface PurchaseItemInput {
	item_id: number;
	quantity: number;       // paid quantity (units/bottles)
	cost_price: number;     // per unit cost for paid portion
	pack_size?: number | null;
	scheme_qty?: number;    // free bottles (optional)
	batch_number?: string | null;
	expiry_date?: string | null; // ISO date or null
}

export interface CreatePurchaseInput {
	vendor_id: number;
	invoice_no: string;
	purchase_date?: string; // ISO date (optional; server will default to now)
	created_by?: number | null;
	total_amount?: number | null; // user-provided total (optional)
	items: PurchaseItemInput[];
}
