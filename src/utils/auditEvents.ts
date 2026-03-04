export const AuditEvent = {
	// Auth
	USER_LOGIN:          "USER_LOGIN",
	USER_LOGOUT:         "USER_LOGOUT",

	// Users / Admin
	USER_CREATE:         "USER_CREATE",
	USER_UPDATE:         "USER_UPDATE",
	USER_DELETE:         "USER_DELETE",

	// Purchases & Vendors
	PURCHASE_CREATE:     "PURCHASE_CREATE",
	PURCHASE_DELETE:     "PURCHASE_DELETE",
	PURCHASE_PAYMENT:    "PURCHASE_PAYMENT",

	// Billing
	BILL_CREATE:         "BILL_CREATE",
	BILL_CLOSE:          "BILL_CLOSE",
	BILL_PAY:            "BILL_PAY",
	BILL_CREDIT:         "BILL_CREDIT",         // marked as udhar
	BILL_CANCEL:         "BILL_CANCEL",

	// KOT
	KOT_CREATE:          "KOT_CREATE",
	KOT_ITEM_ADD:        "KOT_ITEM_ADD",
	KOT_ITEM_REMOVE:     "KOT_ITEM_REMOVE",
	KOT_SERVE:           "KOT_SERVE",
	KOT_CLOSE:           "KOT_CLOSE",
	KOT_CANCEL:          "KOT_CANCEL",

	// Liquor / Bottles
	BOTTLE_BREAK:        "BOTTLE_BREAK",        // sealed bottle opened/broken
	BOTTLE_CLOSE:        "BOTTLE_CLOSE",        // open bottle closed/finished

	// Stock
	STOCK_ADJUST:        "STOCK_ADJUST",

	// Day-end
	DAY_CLOSE:           "DAY_CLOSE",
	DAY_REOPEN:          "DAY_REOPEN",
} as const;

export type AuditEventType = typeof AuditEvent[keyof typeof AuditEvent];
