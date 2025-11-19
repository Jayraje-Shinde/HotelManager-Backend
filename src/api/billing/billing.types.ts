// src/api/billing/billing.types.ts

export interface BillItemInput {
	item_id: number;
	quantity?: number;    // sealed bottle or dish qty
	price?: number;       // override unit price
	shot_ml?: number;     // if present => shot sale
}

export type PaymentInput = {
	method: "CASH" | "UPI" | "CREDITCARD" | "DEBITCARD";
	amount: number;
	referenceNo?: string | null;
};

export interface CreateBillInput {
	table_no: string;
	user_id?: number | null;
	items: BillItemInput[];           // extra manual items (optional for from-kot)
	payments?: PaymentInput[];        // ONE request-level batch of payments (sum must equal finalTotal)
	discount_flat?: number;
	discount_percent?: number;
	is_temp?: boolean;                // keep OPEN if true (no payments provided)
	zone?: string;
}

export interface CreateBillFromKOTInput {
	kot_ids?: number[];               // list of KOT IDs to consolidate (if omitted, use table_no)
	table_no?: string;                // optional — required if kot_ids not passed
	user_id?: number | null;
	extra_items?: BillItemInput[];    // extra manual lines at billing time
	payments?: PaymentInput[];        // ONE shot: must match finalTotal if provided
	discount_flat?: number;
	discount_percent?: number;
	is_temp?: boolean;
	zone?: string;
}
