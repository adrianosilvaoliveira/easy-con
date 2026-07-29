-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'KIT');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "product_type" "ProductType" NOT NULL DEFAULT 'PRODUCT';

-- CreateIndex
CREATE INDEX "products_product_type_idx" ON "products"("product_type");

-- CreateTable
CREATE TABLE "product_kit_items" (
    "id" TEXT NOT NULL,
    "kit_product_id" TEXT NOT NULL,
    "component_product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "batch_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_kit_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_kit_items_kit_product_id_idx" ON "product_kit_items"("kit_product_id");

-- CreateIndex
CREATE INDEX "product_kit_items_component_product_id_idx" ON "product_kit_items"("component_product_id");

-- CreateIndex
CREATE INDEX "product_kit_items_batch_id_idx" ON "product_kit_items"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_kit_items_kit_product_id_component_product_id_batch_id_key" ON "product_kit_items"("kit_product_id", "component_product_id", "batch_id");

-- AddForeignKey
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_kit_product_id_fkey" FOREIGN KEY ("kit_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_kit_items" ADD CONSTRAINT "product_kit_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
