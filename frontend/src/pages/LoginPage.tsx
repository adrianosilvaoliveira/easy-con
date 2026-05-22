import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { AuthResponse } from '@/types';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha obrigatória'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post<{ success: boolean; data: AuthResponse }>('/auth/login', data),
    onSuccess: ({ data }) => {
      const { accessToken, refreshToken, user } = data.data;
      setAuth(accessToken, refreshToken, user);
      toast.success('Bem-vindo!');
      navigate('/');
    },
    onError: (err: unknown) => {
      const ax = err as { code?: string; response?: { status?: number; data?: { message?: string } } };
      if (ax.code === 'ECONNABORTED') {
        toast.error('Servidor demorou para responder. Tente de novo em instantes.');
        return;
      }
      const status = ax.response?.status;
      const msg = ax.response?.data?.message;
      if (status === 503) {
        toast.error(msg ?? 'Banco sem tabelas. Rode o seed no Postgres (ver README).');
        return;
      }
      if (status === 404 || status === 502) {
        toast.error('API indisponível. Use https://constock-teal.vercel.app');
        return;
      }
      toast.error(msg ?? 'Credenciais inválidas');
    },
  });

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 overflow-hidden lg:block">
        <img
          src="/images/con_logo.svg"
          alt="Easy Stock"
          className="absolute inset-0 h-full w-full object-contain object-center bg-[#0D47A1]"
        />
      </div>
      <div className="flex flex-1 items-center justify-center bg-white p-4 sm:p-8 dark:bg-slate-900">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <img
              src="/images/con_logo.svg"
              alt="Logo"
              className="mb-6 h-12 w-auto object-contain object-left lg:hidden"
            />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Entrar no sistema</h2>
            <p className="text-slate-500 dark:text-slate-400">Acesse com suas credenciais</p>
          </div>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
            <Input label="Senha" type="password" error={errors.password?.message} {...register('password')} />
            <Button type="submit" className="w-full" loading={mutation.isPending}>
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
