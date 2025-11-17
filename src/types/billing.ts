// ========= BILLING TYPES =========

// Payment object
export interface PaymentInput {
	method: string;       // CASH, CARD, UPI, etc.
	amount: number;       // must be > 0
	referenceNo?: string; // optional future use
}

// First billing call input
export interface CreateBillingInput {
	table_no: string;       // A1, G4, VIP2, etc.
	user_id?: number | null; // cashier or waiter finalizing the bill

	// discounts — only one allowed at a time
	discount_flat?: number | null;
	discount_percent?: number | null;

	// First billing must have payments (as per your choice)
	payments: PaymentInput[];
}

// Used by service internally
export interface BillItemInput {
	item_id: number;
	quantity: number;
	price?: number;
}
