import { LoaderCircle } from 'lucide-react';
import { ButtonHTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
export function Button({
  className = '',
  busy,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      className={twMerge(
        'flex items-center justify-center gap-2 rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 disabled:opacity-60',
        className,
      )}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy && <LoaderCircle size={17} className="animate-spin" />}
      {children}
    </button>
  );
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={twMerge('rounded-2xl border border-slate-200 bg-white p-5 shadow-card', className)}
    >
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: 'blue' | 'green' | 'yellow' | 'red' | 'orange';
}) {
  const colors = {
    blue: 'border-blue/20 bg-blue-50 text-blue',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    yellow: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    orange: 'border-orange-200 bg-orange-50 text-orange-800',
  };
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-bold tracking-wide ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
