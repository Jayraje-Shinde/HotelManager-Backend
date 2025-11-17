export interface CreatePaymentInput {
	method: "CASH" | "UPI" | "CREDITCARD" | "DEBITCARD";
	amount: number;
	referenceNo?: string | null;
}

export interface PaymentInput {
	method: string;
	amount: number;
	referenceNo?: string;
}

export interface MultiplePaymentInput {
	bill_id: number;
	payments: PaymentInput[];
}
