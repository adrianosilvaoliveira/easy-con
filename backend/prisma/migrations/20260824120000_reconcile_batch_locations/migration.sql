-- Transferências reutilizavam o UUID do lote de origem. O saldo físico ficava
-- em um local e o cadastro do lote em outro: o relatório de vencimentos e a
-- tela de estoque discordavam, e o mesmo número de lote aparecia duplicado.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO product_batches (
  id,
  "productId",
  stock_location_id,
  batch_number,
  expiration_date,
  manufacturing_date,
  quantity,
  supplier_id,
  unit_cost,
  status,
  created_by,
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT ON (pb."productId", si."locationId", pb.batch_number)
  gen_random_uuid()::text,
  pb."productId",
  si."locationId",
  pb.batch_number,
  pb.expiration_date,
  pb.manufacturing_date,
  0,
  pb.supplier_id,
  pb.unit_cost,
  pb.status,
  pb.created_by,
  NOW(),
  NOW()
FROM stock_items si
JOIN product_batches pb ON pb.id = si."batchId"
WHERE si."locationId" IS DISTINCT FROM pb.stock_location_id
  AND NOT EXISTS (
    SELECT 1
    FROM product_batches x
    WHERE x."productId" = pb."productId"
      AND x.stock_location_id = si."locationId"
      AND x.batch_number = pb.batch_number
  )
ORDER BY pb."productId", si."locationId", pb.batch_number, pb.expiration_date ASC;

DO $$
DECLARE
  r RECORD;
  local_id TEXT;
  target_id TEXT;
BEGIN
  FOR r IN
    SELECT
      si.id,
      si."productId",
      si."locationId",
      si.quantity,
      si."batchId",
      pb.batch_number
    FROM stock_items si
    JOIN product_batches pb ON pb.id = si."batchId"
    WHERE si."locationId" IS DISTINCT FROM pb.stock_location_id
  LOOP
    SELECT pb.id INTO local_id
    FROM product_batches pb
    WHERE pb."productId" = r."productId"
      AND pb.stock_location_id = r."locationId"
      AND pb.batch_number = r.batch_number;

    IF local_id IS NULL OR local_id = r."batchId" THEN
      CONTINUE;
    END IF;

    SELECT si.id INTO target_id
    FROM stock_items si
    WHERE si."productId" = r."productId"
      AND si."locationId" = r."locationId"
      AND si."batchId" = local_id
      AND si.id <> r.id;

    IF target_id IS NOT NULL THEN
      UPDATE stock_items
      SET quantity = quantity + r.quantity, "updatedAt" = NOW()
      WHERE id = target_id;
      DELETE FROM stock_items WHERE id = r.id;
    ELSE
      UPDATE stock_items
      SET "batchId" = local_id, "updatedAt" = NOW()
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

UPDATE product_batches pb
SET
  quantity = COALESCE(s.qty, 0),
  "updatedAt" = NOW()
FROM (
  SELECT "batchId" AS id, SUM(quantity)::int AS qty
  FROM stock_items
  WHERE "batchId" IS NOT NULL
  GROUP BY "batchId"
) s
WHERE pb.id = s.id;

UPDATE product_batches pb
SET quantity = 0, "updatedAt" = NOW()
WHERE pb.quantity <> 0
  AND NOT EXISTS (
    SELECT 1 FROM stock_items si WHERE si."batchId" = pb.id
  );
