export interface PaymentInput {
	method: string;
	amount: number;
	referenceNo?: string;
}

export interface MultiplePaymentInput {
	bill_id: number;
	payments: PaymentInput[];
}
