-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
