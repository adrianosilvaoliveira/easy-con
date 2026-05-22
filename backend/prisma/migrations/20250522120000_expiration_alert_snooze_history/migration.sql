-- Histórico e adiar alertas de vencimento
ALTER TABLE "expiration_alerts" ADD COLUMN IF NOT EXISTS "visualized_at" TIMESTAMP(3);
ALTER TABLE "expiration_alerts" ADD COLUMN IF NOT EXISTS "snoozed_until" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "expiration_alerts_visualized_at_idx" ON "expiration_alerts"("visualized_at");
CREATE INDEX IF NOT EXISTS "expiration_alerts_snoozed_until_idx" ON "expiration_alerts"("snoozed_until");

UPDATE "expiration_alerts"
SET "visualized_at" = "alert_date"
WHERE "visualized" = true AND "visualized_at" IS NULL;
