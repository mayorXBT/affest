'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MiniOption<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
};

export function MiniSelect<T extends string>({
  value,
  placeholder,
  options,
  onChange,
  title,
  tone = 'field',
  compact = false,
  leading,
}: {
  value?: T;
  placeholder: string;
  options: MiniOption<T>[];
  onChange: (id: T) => void;
  title?: string;
  tone?: 'field' | 'cyan' | 'cream';
  compact?: boolean;
  leading?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onOther() {
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('affest-select-open', onOther);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('affest-select-open', onOther);
    };
  }, []);

  const toneClass = {
    field: 'border border-[#2c363a] bg-[#141a1d] text-paper',
    cyan: 'bg-[#bfe6f5] text-[#16323d]',
    cream: 'bg-[#efe6c8] text-[#3d3416]',
  }[tone];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          document.dispatchEvent(new Event('affest-select-open'));
          setOpen(true);
        }}
        className={cn(
          'flex h-9 items-center gap-2 rounded-full px-3 text-left text-[12px] font-medium',
          compact ? 'min-w-0' : 'min-w-[148px]',
          toneClass,
        )}
      >
        {leading}
        {selected?.icon}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-[#6f7c7d]')}>
          {selected?.label ?? placeholder}
        </span>
        <span className="text-[11px] opacity-70">▾</span>
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+6px)] left-0 z-30 w-64 rounded-xl border border-line bg-ink-2 p-1">
          {title ? <p className="px-3 py-2 text-[11px] font-semibold text-[#899596]">{title}</p> : null}
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-ink-3"
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
            >
              {option.icon}
              <span className="min-w-0 flex-1">{option.label}</span>
              {option.id === value ? <span className="text-lime">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
