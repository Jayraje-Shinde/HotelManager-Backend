export interface PurchaseItemInput {
	item_id:       number;
	quantity:      number;
	price:         number;
	pack_size?:    number | null;
	scheme_qty?:   number;
	batch_number?: string | null;
	expiry_date?:  string | null;
}

export interface CreatePurchaseInput {
	vendor_id:       number;
	invoice_no:      string;
	purchase_date?:  string;
	created_by?:     number | null;
	total_amount?:   number | null;
	// credit/debit fields
	amount_paid?:    number;          // how much paid now. 0 = full credit, omit = fully paid
	payment_method?: "CASH" | "UPI" | "CREDITCARD" | "DEBITCARD";
	items:           PurchaseItemInput[];
}
