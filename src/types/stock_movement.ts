export interface Stock_movementType {
	item_id: number;
	change_qty: number;
	reason: string;
	ref_type?: string;
	ref_id?: number;
	created_by?: number;
}