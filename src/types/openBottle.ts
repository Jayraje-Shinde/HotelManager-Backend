export interface BreakBottleType {
	item_id: number;     // parent liquor item ID
	user_id?: number;    // who opened/broke the bottle
	reason?: string;     // optional reason for breakage
}
