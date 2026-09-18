-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "gatewayPayload" JSONB,
ADD COLUMN     "paymentRef" TEXT;
