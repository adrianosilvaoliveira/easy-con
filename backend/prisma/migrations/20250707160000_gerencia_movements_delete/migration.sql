-- Concede movements:DELETE ao perfil Gerência
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'GERENCIA'
  AND p.module = 'movements'
  AND p.action = 'DELETE'
ON CONFLICT DO NOTHING;
