export interface PurchaseItemInput {
	item_id: number;
	quantity: number;
	price: number;
}

export interface CreatePurchaseInput {
	vendor_id: number;
	invoice_no: string;
	purchase_date: string;
	created_by?: number;
	items: PurchaseItemInput[];
}