-- Migração segura: preserva lotes existentes (lot / expiry_date) → schema por lote
-- Execute com: npx prisma migrate deploy

-- Enums de vencimento
DO $$ BEGIN
  CREATE TYPE "ExpirationStatus" AS ENUM ('VALID', 'WARNING', 'CRITICAL', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpirationAlertType" AS ENUM ('EXPIRED', 'DAYS_90', 'DAYS_60', 'DAYS_30', 'DAYS_7');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ramo legado: colunas antigas lot + expiry_date
DO $$
DECLARE
  default_location_id TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_batches'
      AND column_name = 'lot'
  ) THEN
    RAISE NOTICE 'Coluna lot não encontrada — migração legada ignorada (schema já atualizado ou tabela vazia).';
    RETURN;
  END IF;

  SELECT id INTO default_location_id
  FROM stock_locations
  WHERE active = true
  ORDER BY code
  LIMIT 1;

  IF default_location_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum local de estoque ativo. Crie ao menos um stock_location antes da migração.';
  END IF;

  ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS batch_number TEXT;
  ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMP(3);
  ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS stock_location_id TEXT;
  ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS manufacturing_date TIMESTAMP(3);
  ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS supplier_id TEXT;
  ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,2);
  ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS status "ExpirationStatus" NOT NULL DEFAULT 'VALID';
  ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS created_by TEXT;

  UPDATE product_batches
  SET batch_number = COALESCE(batch_number, lot)
  WHERE batch_number IS NULL;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_batches' AND column_name = 'expiry_date'
  ) THEN
    UPDATE product_batches
    SET expiration_date = COALESCE(expiration_date, expiry_date)
    WHERE expiration_date IS NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_batches' AND column_name = 'expiryDate'
  ) THEN
    UPDATE product_batches
    SET expiration_date = COALESCE(expiration_date, "expiryDate")
    WHERE expiration_date IS NULL;
  END IF;

  UPDATE product_batches pb
  SET manufacturing_date = COALESCE(pb.manufacturing_date, pb."createdAt")
  WHERE pb.manufacturing_date IS NULL;

  UPDATE product_batches pb
  SET stock_location_id = COALESCE(
    pb.stock_location_id,
    (
      SELECT si."locationId"
      FROM stock_items si
      WHERE si."batchId" = pb.id
      LIMIT 1
    ),
    default_location_id
  )
  WHERE pb.stock_location_id IS NULL;

  UPDATE product_batches pb
  SET stock_location_id = default_location_id
  WHERE pb.stock_location_id IS NULL;

  UPDATE product_batches pb
  SET quantity = COALESCE(
    NULLIF(pb.quantity, 0),
    (SELECT COALESCE(SUM(si.quantity), 0)::INTEGER FROM stock_items si WHERE si."batchId" = pb.id),
    0
  );

  UPDATE product_batches
  SET status = CASE
    WHEN expiration_date::date < CURRENT_DATE THEN 'EXPIRED'::"ExpirationStatus"
    WHEN expiration_date::date <= CURRENT_DATE + INTERVAL '30 days' THEN 'CRITICAL'::"ExpirationStatus"
    WHEN expiration_date::date <= CURRENT_DATE + INTERVAL '90 days' THEN 'WARNING'::"ExpirationStatus"
    ELSE 'VALID'::"ExpirationStatus"
  END;

  ALTER TABLE product_batches ALTER COLUMN batch_number SET NOT NULL;
  ALTER TABLE product_batches ALTER COLUMN expiration_date SET NOT NULL;
  ALTER TABLE product_batches ALTER COLUMN stock_location_id SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_batches_stock_location_id_fkey'
  ) THEN
    ALTER TABLE product_batches
      ADD CONSTRAINT product_batches_stock_location_id_fkey
      FOREIGN KEY (stock_location_id) REFERENCES stock_locations(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_batches_supplier_id_fkey'
  ) THEN
    ALTER TABLE product_batches
      ADD CONSTRAINT product_batches_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_batches_created_by_fkey'
  ) THEN
    ALTER TABLE product_batches
      ADD CONSTRAINT product_batches_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  ALTER TABLE product_batches DROP CONSTRAINT IF EXISTS product_batches_product_id_lot_key;
  DROP INDEX IF EXISTS product_batches_product_id_lot_key;

  ALTER TABLE product_batches DROP COLUMN IF EXISTS lot;
  ALTER TABLE product_batches DROP COLUMN IF EXISTS expiry_date;
  ALTER TABLE product_batches DROP COLUMN IF EXISTS "expiryDate";

  CREATE UNIQUE INDEX IF NOT EXISTS product_batches_product_id_stock_location_id_batch_number_key
    ON product_batches ("productId", stock_location_id, batch_number);

  CREATE INDEX IF NOT EXISTS product_batches_expiration_date_idx ON product_batches (expiration_date);
  CREATE INDEX IF NOT EXISTS product_batches_status_idx ON product_batches (status);
  CREATE INDEX IF NOT EXISTS product_batches_stock_location_id_idx ON product_batches (stock_location_id);

  RAISE NOTICE 'Migração legada product_batches concluída (% registros).', (SELECT COUNT(*) FROM product_batches);
END $$;

-- Tabela de alertas (se ainda não existir)
CREATE TABLE IF NOT EXISTS expiration_alerts (
  id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  alert_type "ExpirationAlertType" NOT NULL,
  alert_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visualized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT expiration_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT expiration_alerts_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES product_batches(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS expiration_alerts_batch_id_alert_type_key
  ON expiration_alerts (batch_id, alert_type);

CREATE INDEX IF NOT EXISTS expiration_alerts_visualized_idx ON expiration_alerts (visualized);
CREATE INDEX IF NOT EXISTS expiration_alerts_alert_date_idx ON expiration_alerts (alert_date);
