import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProductSearchSelect, type ProductOption } from '@/components/products/ProductSearchSelect';
import { useAvailableLots } from '@/hooks/queries/useAvailableLots';
import { useLocations } from '@/hooks/queries/useLocations';
import { formatDate, formatProductName } from '@/utils/format';
import { getApiErrorMessage } from '@/utils/apiError';
import type { Product, ProductKitItem } from '@/types';
import { cn } from '@/utils/cn';

type AssemblyLine = {
  key: string;
  componentProductId: string;
  name: string;
  quantityPerKit: number;
  batchId: string;
  preferredBatchId?: string;
  preferredBatchNumber?: string;
  hasLots?: boolean;
};

type KitAssemblyModalProps = {
  open: boolean;
  onClose: () => void;
  /** Pré-seleciona o kit (ex.: linha da aba Kits). */
  initialKitId?: string | null;
  onSuccess?: () => void;
};

function ComponentLotSelect({
  productId,
  locationId,
  value,
  preferredBatchId,
  preferredBatchNumber,
  onChange,
  onLotsResolved,
  requiredQty,
  excludeBatchIds,
}: {
  productId: string;
  locationId?: string;
  value: string;
  preferredBatchId?: string;
  preferredBatchNumber?: string;
  onChange: (batchId: string) => void;
  onLotsResolved?: (hasLots: boolean) => void;
  requiredQty: number;
  excludeBatchIds?: string[];
}) {
  const { lots, hasLots, isLoading } = useAvailableLots(
    productId,
    locationId,
    !!productId && !!locationId
  );

  useEffect(() => {
    if (!locationId || isLoading) return;
    onLotsResolved?.(hasLots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLots, isLoading, locationId]);

  useEffect(() => {
    if (!hasLots || isLoading) return;
    const preferred =
      (preferredBatchId && lots.some((l) => l.batchId === preferredBatchId)
        ? preferredBatchId
        : undefined) ||
      (preferredBatchNumber
        ? lots.find((l) => l.batchNumber === preferredBatchNumber)?.batchId
        : undefined);
    const taken = new Set(excludeBatchIds ?? []);
    const valueInLots = Boolean(value && lots.some((l) => l.batchId === value));
    if (preferred && (!valueInLots) && preferred !== value) {
      if (!taken.has(preferred)) onChange(preferred);
      return;
    }
    if (valueInLots) return;
    if (!value && lots.length === 1 && !taken.has(lots[0].batchId)) {
      onChange(lots[0].batchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLots, isLoading, lots, value, preferredBatchId, preferredBatchNumber]);

  if (!locationId) {
    return preferredBatchNumber ? (
      <p className="rounded border border-teal-200 bg-teal-50/60 px-2 py-1.5 text-xs text-teal-800 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
        Lote gravado: {preferredBatchNumber}
      </p>
    ) : (
      <p className="text-xs text-slate-500">Selecione o local primeiro</p>
    );
  }
  if (isLoading) {
    return <p className="text-xs text-slate-500">Carregando lotes...</p>;
  }
  if (!hasLots) {
    return (
      <p className="rounded border border-dashed border-slate-200 px-2 py-1.5 text-xs text-amber-700 dark:border-slate-600 dark:text-amber-400">
        Sem estoque neste local (necessário {requiredQty} un.)
      </p>
    );
  }

  const savedLotMissing =
    Boolean(preferredBatchNumber) &&
    !lots.some(
      (l) =>
        l.batchId === preferredBatchId || l.batchNumber === preferredBatchNumber
    );

  return (
    <div className="space-y-1">
      {preferredBatchNumber && !savedLotMissing && (
        <p className="text-[11px] text-teal-700 dark:text-teal-300">
          Lote da composição: {preferredBatchNumber}
        </p>
      )}
      {savedLotMissing && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Lote gravado ({preferredBatchNumber}) não está neste local
        </p>
      )}
      <select
        className={cn('input-field w-full text-sm', !value && 'border-amber-400')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={hasLots}
      >
        <option value="">
          {preferredBatchNumber && !savedLotMissing
            ? 'Usando lote da composição'
            : lots.length > 1
              ? 'Selecione o lote *'
              : 'Selecione o lote...'}
        </option>
        {lots.map((lot) => (
          <option
            key={lot.batchId}
            value={lot.batchId}
            disabled={
              lot.quantity < requiredQty || Boolean(excludeBatchIds?.includes(lot.batchId))
            }
          >
            {lot.batchNumber}
            {lot.expirationDate ? ` — Val. ${formatDate(lot.expirationDate)}` : ''}
            {` (${lot.quantity} un.)`}
            {excludeBatchIds?.includes(lot.batchId) ? ' — já na lista' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

function linesFromKit(kit: Product): AssemblyLine[] {
  return (kit.kitItems ?? []).map((ki: ProductKitItem) => ({
    key: ki.id,
    componentProductId: ki.componentProductId || ki.componentProduct.id,
    name: ki.componentProduct.name,
    quantityPerKit: ki.quantity,
    batchId: ki.batchId || ki.batch?.id || '',
    preferredBatchId: ki.batchId || ki.batch?.id || undefined,
    preferredBatchNumber: ki.batch?.batchNumber || undefined,
  }));
}

function uniqueLocationFromKit(kit: Product): string {
  const ids = (kit.kitItems ?? [])
    .map((ki) => ki.batch?.stockLocation?.id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return '';
  return ids.every((id) => id === ids[0]) ? ids[0] : '';
}

export function KitAssemblyModal({
  open,
  onClose,
  initialKitId,
  onSuccess,
}: KitAssemblyModalProps) {
  const queryClient = useQueryClient();
  const { data: locations, isLoading: locationsLoading } = useLocations();

  const [selectedKit, setSelectedKit] = useState<ProductOption | null>(null);
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [batchNumber, setBatchNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<AssemblyLine[]>([]);
  const [formError, setFormError] = useState('');

  const kitId = selectedKit?.id || initialKitId || undefined;

  const { data: kitDetail, isLoading: kitLoading } = useQuery({
    queryKey: ['product', kitId, 'kit-assembly'],
    queryFn: () => api.get(`/products/${kitId}`).then((r) => r.data.data as Product),
    enabled: open && !!kitId,
  });

  useEffect(() => {
    if (!open) return;
    setLocationId('');
    setQuantity(1);
    setBatchNumber('');
    setExpirationDate('');
    setManufacturingDate(new Date().toISOString().slice(0, 10));
    setReason('');
    setFormError('');
    setLines([]);
    if (!initialKitId) {
      setSelectedKit(null);
    }
  }, [open, initialKitId]);

  useEffect(() => {
    if (!open || kitDetail?.productType !== 'KIT' || !kitDetail.kitItems?.length) return;
    setLines(linesFromKit(kitDetail));
    setLocationId(uniqueLocationFromKit(kitDetail));
    if (!selectedKit || selectedKit.id !== kitDetail.id) {
      setSelectedKit({
        id: kitDetail.id,
        name: kitDetail.name,
        internalCode: kitDetail.internalCode,
        productType: kitDetail.productType,
        barcode: kitDetail.barcode,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kitDetail?.id]);

  useEffect(() => {
    setLines((prev) =>
      prev.map((l) => ({ ...l, batchId: '', hasLots: undefined }))
    );
  }, [locationId]);

  const kitQty = Math.max(1, quantity || 1);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/movements/kit-assemblies', payload),
    onSuccess: (res) => {
      const pending = res.data.data?.pendingApproval;
      toast.success(
        pending
          ? 'Montagem enviada para aprovação'
          : 'Kit montado — estoque do kit atualizado'
      );
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['kits'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Erro ao montar kit')),
  });

  const updateLine = (key: string, patch: Partial<AssemblyLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!kitId) {
      setFormError('Selecione o kit');
      return;
    }
    if (!locationId) {
      setFormError('Selecione o local de montagem');
      return;
    }
    if (!batchNumber.trim()) {
      setFormError('Informe o número do lote do kit');
      return;
    }
    if (!expirationDate) {
      setFormError('Informe a validade do lote do kit');
      return;
    }
    if (lines.length < 2) {
      setFormError('Kit sem composição válida');
      return;
    }
    for (const line of lines) {
      if (line.hasLots && !line.batchId) {
        setFormError(`Selecione o lote de "${formatProductName(line.name)}"`);
        return;
      }
    }
    const seen = new Set<string>();
    for (const line of lines) {
      const key = `${line.componentProductId}:${line.batchId || 'none'}`;
      if (seen.has(key)) {
        setFormError(
          `"${formatProductName(line.name)}" está repetido com o mesmo lote. Altere o lote.`
        );
        return;
      }
      seen.add(key);
    }
    setFormError('');
    mutation.mutate({
      kitProductId: kitId,
      destinationLocationId: locationId,
      quantity: kitQty,
      batchNumber: batchNumber.trim(),
      expirationDate,
      manufacturingDate: manufacturingDate || undefined,
      reason: reason.trim() || undefined,
      components: lines.map((l) => ({
        componentProductId: l.componentProductId,
        quantity: l.quantityPerKit * kitQty,
        batchId: l.batchId || undefined,
      })),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Montar kit"
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="kit-assembly-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Montando...' : 'Registrar montagem'}
          </Button>
        </div>
      }
    >
      <form id="kit-assembly-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ProductSearchSelect
            value={kitId || ''}
            label="Kit"
            required
            productType="KIT"
            allowCreate={false}
            onChange={(id, product) => {
              setSelectedKit(product ?? null);
              setLines([]);
              setLocationId('');
              if (!id) setSelectedKit(null);
            }}
          />
        </div>

        <div>
          <label className="form-label">Local de montagem *</label>
          <select
            className="input-field w-full"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            required
            disabled={locationsLoading}
          >
            <option value="">Selecione o local...</option>
            {(locations ?? []).map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Componentes serão baixados neste local e o kit entrará no mesmo local.
          </p>
        </div>

        <Input
          label="Quantidade de kits *"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          required
        />

        <Input
          label="Lote do kit *"
          value={batchNumber}
          onChange={(e) => setBatchNumber(e.target.value)}
          placeholder="Ex.: 2609-125"
          required
        />

        <Input
          label="Validade do kit *"
          type="date"
          value={expirationDate}
          onChange={(e) => setExpirationDate(e.target.value)}
          required
        />

        <Input
          label="Fabricação"
          type="date"
          value={manufacturingDate}
          onChange={(e) => setManufacturingDate(e.target.value)}
        />

        <Input
          label="Motivo"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Opcional"
        />

        <div className="sm:col-span-2 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Componentes a baixar
            </h3>
            <p className="text-xs text-slate-500">
              Lotes gravados na composição são usados automaticamente. Quantidades = composição × kits.
            </p>
          </div>

          {kitLoading ? (
            <p className="text-sm text-slate-500">Carregando composição...</p>
          ) : lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-slate-600">
              Selecione um kit com composição cadastrada.
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((line) => {
                const need = line.quantityPerKit * kitQty;
                return (
                  <div
                    key={line.key}
                    className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end dark:border-slate-600"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {formatProductName(line.name)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {line.quantityPerKit}/kit · total {need} un.
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 sm:pb-2">Baixa: {need}</div>
                    <div>
                      <label className="form-label">Lote</label>
                      <ComponentLotSelect
                        productId={line.componentProductId}
                        locationId={locationId || undefined}
                        value={line.batchId}
                        preferredBatchId={line.preferredBatchId}
                        preferredBatchNumber={line.preferredBatchNumber}
                        requiredQty={need}
                        excludeBatchIds={lines
                          .filter(
                            (l) =>
                              l.key !== line.key &&
                              l.componentProductId === line.componentProductId &&
                              l.batchId
                          )
                          .map((l) => l.batchId)}
                        onChange={(batchId) => updateLine(line.key, { batchId })}
                        onLotsResolved={(hasLots) => {
                          if (line.hasLots !== hasLots) {
                            updateLine(line.key, {
                              hasLots,
                              ...(hasLots ? {} : { batchId: '' }),
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {formError && (
          <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">{formError}</p>
        )}
      </form>
    </Modal>
  );
}
