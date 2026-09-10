'use client';

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

type Tone = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
}

const tones: Record<Tone, { wrapper: string; chip: string; icon: typeof InformationCircleIcon }> = {
  info: {
    wrapper: 'bg-blue-50/70 border-blue-200 text-blue-900',
    chip: 'bg-blue-100 text-blue-600',
    icon: InformationCircleIcon,
  },
  success: {
    wrapper: 'bg-green-50/70 border-green-200 text-green-900',
    chip: 'bg-green-100 text-green-600',
    icon: CheckCircleIcon,
  },
  warning: {
    wrapper: 'bg-amber-50/70 border-amber-200 text-amber-900',
    chip: 'bg-amber-100 text-amber-600',
    icon: ExclamationTriangleIcon,
  },
  error: {
    wrapper: 'bg-red-50/70 border-red-200 text-red-900',
    chip: 'bg-red-100 text-red-600',
    icon: XCircleIcon,
  },
};

export default function Alert({ tone = 'info', title, children }: AlertProps) {
  const { wrapper, chip, icon: Icon } = tones[tone];
  return (
    <div role="alert" className={`flex gap-3 rounded border px-4 py-3 text-sm ${wrapper}`}>
      <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${chip}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
