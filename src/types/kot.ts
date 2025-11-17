// ========= KOT TYPES =========

// Single KOT line item
export interface KOTItemInput {
	item_id: number;
	quantity: number;

	// Optional shot sale (liquor only)
	shot_ml?: number;   // 30 / 60 / 90 etc.
	note?: string;
}

// Create KOT input
export interface CreateKOTInput {
	table_no: string;
	waiter_id: number;
	items: KOTItemInput[];
}

// KOT status enum for readability
export type KOTStatus = "OPEN" | "SENT" | "SERVED" | "CANCELLED" | "CLOSED";
