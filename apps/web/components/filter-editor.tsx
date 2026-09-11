'use client';

import { Trash2 } from 'lucide-react';
import { MiniSelect } from '@/components/mini-select';
import {
  type FilterBlock,
  type FilterFn,
  type FilterOrder,
  filterFnLabels,
  filterFnOptions,
  filterOrderOptions,
  formatFilter,
  parseCount,
} from '@/lib/filter';

export function FilterCanvas({
  block,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  block: FilterBlock;
  open: boolean;
  onToggle: () => void;
  onChange: (block: FilterBlock) => void;
  onRemove: () => void;
}) {
  const orderLabel = block.order === 'top' ? 'Top' : 'Bottom';
  const sortLabel = block.sort.kind === 'metric' ? filterFnLabels[block.sort.fn] : undefined;

  return (
    <div className="relative flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-block="filter"
          onClick={onToggle}
          className="flex items-center rounded-full bg-[#c9d4f5] text-[13px] font-semibold text-[#1b2440]"
        >
          <span className="pl-4 pr-1 py-2">Sort{sortLabel ? ` ${sortLabel}` : ''}</span>
          <span className="px-1 py-2 font-medium opacity-80">Select</span>
          <span className="mr-1 rounded-full bg-[#dde4f8] px-3 py-1.5">
            {orderLabel} {block.count} ▾
          </span>
        </button>
        <button
          type="button"
          className="grid size-8 place-items-center rounded-full border border-[#3a2a2a] text-[#f0b3a5]"
          aria-label="Remove filter"
          onClick={onRemove}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open ? (
        <div className="z-20 w-[min(360px,calc(100vw-3rem))] rounded-2xl border border-line bg-ink-2 p-4">
          <p className="m-0 text-[13px] font-semibold">Edit filter</p>
          <p className="mt-0.5 mb-4 text-[11px] text-[#6f7c7d]">Dynamic filter</p>
          <label className="mb-3 flex items-center gap-3">
            <span className="w-[72px] shrink-0 text-[12px] text-[#899596]">sort by</span>
            <MiniSelect
              value={block.sort.kind === 'metric' ? block.sort.fn : undefined}
              placeholder="Choose function"
              title="Select sort function"
              options={filterFnOptions}
              onChange={(fn: FilterFn) => onChange({ ...block, sort: { kind: 'metric', fn } })}
            />
          </label>
          <label className="mb-3 flex items-center gap-3">
            <span className="w-[72px] shrink-0 text-[12px] text-[#899596]">select</span>
            <div data-field="filter-order">
              <MiniSelect
                value={block.order}
                placeholder="Top"
                title="Select ordering function"
                options={filterOrderOptions}
                onChange={(order: FilterOrder) => onChange({ ...block, order })}
              />
            </div>
          </label>
          <label className="flex items-center gap-3">
            <span className="w-[72px] shrink-0 text-[12px] text-[#899596]">how many</span>
            <input
              className="h-9 w-16 rounded-md border border-[#2c363a] bg-[#141a1d] px-2 text-center text-[13px]"
              value={String(block.count)}
              onChange={(event) => onChange({ ...block, count: parseCount(event.target.value) })}
            />
          </label>
        </div>
      ) : null}
      <span className="sr-only">{formatFilter(block)}</span>
    </div>
  );
}
