'use client';

type Tone = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
}

const tones: Record<Tone, { wrapper: string; icon: string }> = {
  info: { wrapper: 'bg-blue-50 border-blue-300 text-blue-800', icon: 'ℹ️' },
  success: { wrapper: 'bg-green-50 border-green-300 text-green-800', icon: '✅' },
  warning: { wrapper: 'bg-amber-50 border-amber-300 text-amber-800', icon: '⚠️' },
  error: { wrapper: 'bg-red-50 border-red-300 text-red-800', icon: '⛔' },
};

export default function Alert({ tone = 'info', title, children }: AlertProps) {
  const t = tones[tone];
  return (
    <div role="alert" className={`flex gap-3 rounded border px-4 py-3 text-sm ${t.wrapper}`}>
      <span aria-hidden>{t.icon}</span>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
