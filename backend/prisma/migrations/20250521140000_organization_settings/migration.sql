-- CreateTable
CREATE TABLE "organization_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- Registro inicial (valores padrão; ajuste em Configurações)
INSERT INTO "organization_settings" ("id", "name", "cnpj", "address", "phone", "email", "updatedAt")
VALUES (
    'default',
    'CON - Centro Oftalmológico de Naviraí',
    NULL,
    NULL,
    NULL,
    NULL,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
