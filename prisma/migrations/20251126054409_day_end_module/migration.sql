-- AlterTable
ALTER TABLE "Auditlog" ADD COLUMN     "dayClosingId" INTEGER;

-- CreateTable
CREATE TABLE "DayClosing" (
    "id" SERIAL NOT NULL,
    "business_date" TIMESTAMP(3) NOT NULL,
    "closed_by" INTEGER NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'CLOSED',
    "note" TEXT,
    "total_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_payments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_stock_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "open_kots_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopen_allowed" BOOLEAN NOT NULL DEFAULT false,
    "reopen_by" INTEGER,
    "reopen_at" TIMESTAMP(3),

    CONSTRAINT "DayClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DaySalesSnapshot" (
    "id" SERIAL NOT NULL,
    "day_closing_id" INTEGER NOT NULL,
    "bill_id" INTEGER NOT NULL,
    "bill_no" TEXT NOT NULL,
    "bill_date" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER,
    "table_no" TEXT,
    "total" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "status" "BillStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DaySalesSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayPaymentSnapshot" (
    "id" SERIAL NOT NULL,
    "day_closing_id" INTEGER NOT NULL,
    "bill_id" INTEGER NOT NULL,
    "method" "PaymentMethods" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceNo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayPaymentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayStockSnapshot" (
    "id" SERIAL NOT NULL,
    "day_closing_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "stock_snapshot" DOUBLE PRECISION NOT NULL,
    "total_value" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayStockSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayLiquorSnapshot" (
    "id" SERIAL NOT NULL,
    "day_closing_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "opening_bottles" DOUBLE PRECISION NOT NULL,
    "purchased_bottles" DOUBLE PRECISION NOT NULL,
    "broken_bottles" DOUBLE PRECISION NOT NULL,
    "sealed_sold" DOUBLE PRECISION NOT NULL,
    "shots_ml_sold" DOUBLE PRECISION NOT NULL,
    "open_bottles_ml" DOUBLE PRECISION NOT NULL,
    "theoretical_ml" DOUBLE PRECISION NOT NULL,
    "variance_ml" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayLiquorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayKOTSnapshot" (
    "id" SERIAL NOT NULL,
    "day_closing_id" INTEGER NOT NULL,
    "kot_id" INTEGER NOT NULL,
    "waiter_id" INTEGER,
    "table_no" TEXT NOT NULL,
    "status" "KOTStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayKOTSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayClosing_business_date_key" ON "DayClosing"("business_date");

-- CreateIndex
CREATE INDEX "DayClosing_business_date_idx" ON "DayClosing"("business_date");

-- CreateIndex
CREATE INDEX "DayStockSnapshot_item_id_idx" ON "DayStockSnapshot"("item_id");

-- CreateIndex
CREATE INDEX "DayLiquorSnapshot_item_id_idx" ON "DayLiquorSnapshot"("item_id");

-- AddForeignKey
ALTER TABLE "Auditlog" ADD CONSTRAINT "Auditlog_dayClosingId_fkey" FOREIGN KEY ("dayClosingId") REFERENCES "DayClosing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClosing" ADD CONSTRAINT "DayClosing_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DaySalesSnapshot" ADD CONSTRAINT "DaySalesSnapshot_day_closing_id_fkey" FOREIGN KEY ("day_closing_id") REFERENCES "DayClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPaymentSnapshot" ADD CONSTRAINT "DayPaymentSnapshot_day_closing_id_fkey" FOREIGN KEY ("day_closing_id") REFERENCES "DayClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayStockSnapshot" ADD CONSTRAINT "DayStockSnapshot_day_closing_id_fkey" FOREIGN KEY ("day_closing_id") REFERENCES "DayClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayStockSnapshot" ADD CONSTRAINT "DayStockSnapshot_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayLiquorSnapshot" ADD CONSTRAINT "DayLiquorSnapshot_day_closing_id_fkey" FOREIGN KEY ("day_closing_id") REFERENCES "DayClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayLiquorSnapshot" ADD CONSTRAINT "DayLiquorSnapshot_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayKOTSnapshot" ADD CONSTRAINT "DayKOTSnapshot_day_closing_id_fkey" FOREIGN KEY ("day_closing_id") REFERENCES "DayClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
