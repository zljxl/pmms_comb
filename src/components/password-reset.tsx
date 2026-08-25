'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card } from './ui';

export function PasswordReset({ userId, allowed }: { userId: number; allowed: boolean }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const mutation = useMutation({
    mutationFn: () => {
      if (password !== confirmation) throw new Error('As senhas não coincidem.');
      return api(`/users/${userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      });
    },
    onSuccess: () => {
      setPassword('');
      setConfirmation('');
    },
  });

  if (!allowed) return null;
  return (
    <Card>
      <h2 className="text-sm font-semibold">Redefinir senha</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Defina uma senha temporária e comunique-a diretamente ao usuário. A senha atual nunca é
        exibida.
      </p>
      <form
        className="mt-4"
        onSubmit={event => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label>Nova senha</label>
        <input
          type="password"
          minLength={8}
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <div className="mt-3">
          <label>Confirmar nova senha</label>
          <input
            type="password"
            minLength={8}
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {mutation.error && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        {mutation.isSuccess && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            Senha redefinida com sucesso.
          </p>
        )}
        <Button
          busy={mutation.isPending}
          disabled={password.length < 8 || confirmation.length < 8}
          className="mt-4 w-full"
        >
          Redefinir senha
        </Button>
      </form>
    </Card>
  );
}
