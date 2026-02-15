export type PaymentInput = {
	method: "CASH" | "UPI" | "CREDITCARD" | "DEBITCARD";
	amount: number;
	referenceNo?: string | null;
};