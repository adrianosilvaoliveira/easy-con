type ApiErrorPayload = {
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
};

type ApiErrorLike = {
  code?: string;
  response?: {
    status?: number;
    data?: ApiErrorPayload;
  };
};

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const ax = err as ApiErrorLike;
  if (ax.code === 'ECONNABORTED') {
    return 'Servidor demorou para responder. Tente novamente.';
  }
  if (!ax.response) {
    return 'Não foi possível conectar à API. Verifique se o servidor está em execução.';
  }

  const data = ax.response.data;
  const fieldErrors = data?.errors?.map((e) => e.message).filter(Boolean);
  if (fieldErrors?.length) {
    return fieldErrors.join('. ');
  }

  return data?.message || fallback;
}
