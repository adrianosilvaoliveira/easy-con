-- Permissões personalizadas por usuário
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "useCustomAccess" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "user_permissions" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("userId","permissionId"),
    CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
