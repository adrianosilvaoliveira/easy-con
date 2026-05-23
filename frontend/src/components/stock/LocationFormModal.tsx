import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export interface CreatedStockLocation {
  id: string;
  name: string;
  code: string;
}

interface LocationFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (location: CreatedStockLocation) => void;
  initialName?: string;
}

export function LocationFormModal({
  open,
  onClose,
  onSuccess,
  initialName = '',
}: LocationFormModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('CENTRAL');

  useEffect(() => {
    if (!open) return;
    const trimmed = initialName.trim();
    setName(trimmed);
    setCode(
      trimmed
        ? trimmed
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 20)
            .toUpperCase() || ''
        : ''
    );
    setType('CENTRAL');
  }, [open, initialName]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post('/stock/locations', {
        name: name.trim(),
        code: code.trim(),
        type,
      }),
    onSuccess: (res) => {
      const location = res.data.data as CreatedStockLocation;
      toast.success('Local cadastrado');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      onSuccess?.(location);
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao salvar local'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Novo Local de Estoque" size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2) {
            toast.error('Informe o nome do local');
            return;
          }
          if (code.trim().length < 1) {
            toast.error('Informe o código do local');
            return;
          }
          saveMutation.mutate();
        }}
        className="space-y-4"
      >
        <Input
          label="Nome *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input label="Código *" value={code} onChange={(e) => setCode(e.target.value)} />
        <div>
          <label className="form-label">Tipo *</label>
          <select
            className="input-field"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="CENTRAL">Central</option>
            <option value="CENTRO_CIRURGICO">Centro Cirúrgico</option>
            <option value="CONSULTORIO">Consultório</option>
            <option value="FARMACIA">Farmácia</option>
            <option value="SATELITE">Satélite</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saveMutation.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
