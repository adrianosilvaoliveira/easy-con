import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export interface CreatedCategory {
  id: string;
  name: string;
}

interface CategoryFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (category: CreatedCategory) => void;
  initialName?: string;
}

export function CategoryFormModal({
  open,
  onClose,
  onSuccess,
  initialName = '',
}: CategoryFormModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName(initialName.trim());
  }, [open, initialName]);

  const saveMutation = useMutation({
    mutationFn: () => api.post('/products/categories', { name: name.trim() }),
    onSuccess: (res) => {
      const category = res.data.data as CreatedCategory;
      toast.success('Categoria cadastrada');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onSuccess?.(category);
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao salvar categoria'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Nova Categoria" size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2) {
            toast.error('Informe o nome da categoria');
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
