import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { cn } from '@/utils/cn';
import { getRoleLabel, type AssignableRole } from '@/constants/roles';
import { OPERACIONAL_PERMISSIONS } from '@/constants/permissions';

interface PermissionModule {
  module: string;
  label: string;
  permissions: { key: string; action: string; label: string }[];
}

interface UserAccessEditorProps {
  roleName: AssignableRole | 'ADMINISTRADOR';
  useCustomAccess: boolean;
  selectedPermissions: string[];
  onRoleChange: (role: AssignableRole | 'ADMINISTRADOR') => void;
  onUseCustomAccessChange: (value: boolean) => void;
  onPermissionsChange: (permissions: string[]) => void;
  disabled?: boolean;
}

export function UserAccessEditor({
  roleName,
  useCustomAccess,
  selectedPermissions,
  onRoleChange,
  onUseCustomAccessChange,
  onPermissionsChange,
  disabled,
}: UserAccessEditorProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const { data: catalog } = useQuery({
    queryKey: ['permissions-catalog'],
    queryFn: () =>
      api.get('/users/permissions/catalog').then(
        (r) =>
          r.data.data as {
            modules: PermissionModule[];
            defaultOperacional: string[];
          }
      ),
  });

  const isAdmin = roleName === 'ADMINISTRADOR';

  useEffect(() => {
    if (isAdmin && useCustomAccess) {
      onUseCustomAccessChange(false);
    }
  }, [isAdmin, useCustomAccess, onUseCustomAccessChange]);

  const togglePermission = (key: string) => {
    if (disabled || isAdmin) return;
    if (selectedPermissions.includes(key)) {
      onPermissionsChange(selectedPermissions.filter((p) => p !== key));
    } else {
      onPermissionsChange([...selectedPermissions, key]);
    }
  };

  const toggleModule = (mod: PermissionModule, checked: boolean) => {
    if (disabled || isAdmin) return;
    const keys = mod.permissions.map((p) => p.key);
    if (checked) {
      onPermissionsChange([...new Set([...selectedPermissions, ...keys])]);
    } else {
      onPermissionsChange(selectedPermissions.filter((p) => !keys.includes(p)));
    }
  };

  const applyOperacionalDefaults = () => {
    const defaults = catalog?.defaultOperacional ?? [...OPERACIONAL_PERMISSIONS];
    onPermissionsChange([...defaults]);
    onUseCustomAccessChange(true);
  };

  const modules = catalog?.modules ?? [];

  const selectedCount = useMemo(() => selectedPermissions.length, [selectedPermissions]);

  return (
    <div className="space-y-4 sm:col-span-2">
      <div>
        <label className="form-label">Nível de acesso *</label>
        <select
          className="input-field"
          value={roleName}
          disabled={disabled}
          onChange={(e) => onRoleChange(e.target.value as AssignableRole | 'ADMINISTRADOR')}
        >
          <option value="OPERACIONAL">{getRoleLabel('OPERACIONAL')}</option>
          <option value="ADMINISTRADOR">{getRoleLabel('ADMINISTRADOR')}</option>
        </select>
        {isAdmin && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Administrador possui acesso total ao sistema.</p>
        )}
      </div>

      {!isAdmin && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onUseCustomAccessChange(false)}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                !useCustomAccess
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              )}
            >
              Perfil padrão ({getRoleLabel('OPERACIONAL')})
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onUseCustomAccessChange(true);
                if (selectedPermissions.length === 0) {
                  applyOperacionalDefaults();
                }
              }}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                useCustomAccess
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              )}
            >
              Personalizado
            </button>
          </div>

          {useCustomAccess && (
            <div className="rounded-xl border border-surface-border bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-900/50">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Permissões ({selectedCount} selecionadas)
                </p>
                <button
                  type="button"
                  className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                  onClick={applyOperacionalDefaults}
                  disabled={disabled}
                >
                  Restaurar padrão operacional
                </button>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {modules.map((mod) => {
                  const modKeys = mod.permissions.map((p) => p.key);
                  const allChecked = modKeys.every((k) => selectedPermissions.includes(k));
                  const someChecked = modKeys.some((k) => selectedPermissions.includes(k));
                  const isOpen = expandedModules.has(mod.module);

                  return (
                    <div key={mod.module} className="rounded-lg border border-surface-border bg-white dark:border-slate-600 dark:bg-slate-800">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = someChecked && !allChecked;
                          }}
                          disabled={disabled}
                          onChange={(e) => toggleModule(mod, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <button
                          type="button"
                          className="flex flex-1 items-center justify-between text-left text-sm font-medium text-slate-800 dark:text-slate-200"
                          onClick={() =>
                            setExpandedModules((prev) => {
                              const next = new Set(prev);
                              if (next.has(mod.module)) next.delete(mod.module);
                              else next.add(mod.module);
                              return next;
                            })
                          }
                        >
                          {mod.label}
                          <span className="text-xs text-slate-400">{isOpen ? '▲' : '▼'}</span>
                        </button>
                      </div>
                      {isOpen && (
                        <div className="grid gap-1 border-t border-surface-border px-3 py-2 sm:grid-cols-2">
                          {mod.permissions.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(perm.key)}
                                disabled={disabled}
                                onChange={() => togglePermission(perm.key)}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              {perm.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!useCustomAccess && (
            <p className="text-xs text-slate-500">
              Usa as permissões padrão do perfil Operacional. Ative &quot;Personalizado&quot; para
              ajustar módulo a módulo.
            </p>
          )}
        </>
      )}
    </div>
  );
}
