'use client';

import { useState } from 'react';
import { GitBranch, Trash2 } from 'lucide-react';
import { AssetLogo } from '@/components/asset-logo';
import { MiniSelect } from '@/components/mini-select';
import { affestAssets, assetById, type AffestAssetId } from '@/lib/assets';
import {
  type Comparator,
  type ConditionSide,
  type FnId,
  type IfElseBlock,
  comparatorOptions,
  fnOptions,
  formatConditionChip,
  sideFromFn,
} from '@/lib/condition';

const assetOptions = affestAssets.map((item) => ({
  id: item.id,
  label: item.symbol,
  icon: <AssetLogo kind={item.id} size={16} />,
}));

function fnIdOf(side: ConditionSide): FnId | undefined {
  if (side.kind === 'empty') return undefined;
  if (side.kind === 'fixed') return 'fixed';
  return side.fn;
}

function assetOf(side: ConditionSide): AffestAssetId | undefined {
  return side.kind === 'metric' ? side.asset : undefined;
}

function AssetSlot({
  side,
  onChange,
}: {
  side: ConditionSide;
  onChange: (side: ConditionSide) => void;
}) {
  return (
    <MiniSelect
      value={assetOf(side)}
      placeholder="Choose asset"
      title="Select asset"
      options={assetOptions}
      onChange={(asset) => {
        if (side.kind === 'metric') onChange({ ...side, asset });
        else onChange({ kind: 'metric', fn: 'price', asset });
      }}
    />
  );
}

function ValueSlot({
  side,
  onChange,
}: {
  side: ConditionSide;
  onChange: (side: ConditionSide) => void;
}) {
  if (side.kind !== 'fixed') return null;
  return (
    <input
      className="h-9 w-20 rounded-full border border-[#2c363a] bg-[#141a1d] px-3 text-[12px]"
      value={side.value}
      placeholder="0"
      inputMode="decimal"
      onChange={(event) => onChange({ kind: 'fixed', value: event.target.value })}
    />
  );
}

function SelectBlock({
  assets,
  onChange,
  label,
}: {
  assets: AffestAssetId[];
  onChange: (assets: AffestAssetId[]) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const missing = affestAssets.filter((item) => !assets.includes(item.id));

  return (
    <div className="ml-6 flex flex-col items-start gap-2">
      {assets.map((id) => {
        const item = assetById(id);
        return (
          <div key={id} className="flex items-center gap-2">
            <MiniSelect
              compact
              tone="cream"
              value={id}
              placeholder="Choose asset"
              title="Select asset"
              options={assetOptions}
              onChange={(next) => {
                onChange(assets.map((entry) => (entry === id ? next : entry)).filter((entry, index, all) => all.indexOf(entry) === index));
              }}
            />
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full border border-[#3a2a2a] text-[#f0b3a5]"
              aria-label={`Remove ${item.symbol} from ${label}`}
              onClick={() => onChange(assets.filter((entry) => entry !== id))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      {assets.length === 0 && missing.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            data-block={`${label.toLowerCase()}-select`}
            className="rounded-full border border-[#3a4548] bg-[#1b2124] px-3 py-2 text-[13px] text-paper"
            onClick={() => setOpen((value) => !value)}
          >
            Select block ▾
          </button>
          {open ? (
            <div className="absolute top-[calc(100%+6px)] left-0 z-20 w-56 rounded-xl border border-line bg-ink-2 p-2">
              <p className="px-2 pb-1 text-[11px] font-semibold text-[#899596]">Add block</p>
              {missing.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-ink-3"
                  onClick={() => {
                    onChange([...assets, item.id]);
                    setOpen(false);
                  }}
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-[#efe6c8] text-[#3d3416]">
                    <AssetLogo kind={item.id} size={16} />
                  </span>
                  <span>
                    <b className="block text-[13px]">Asset</b>
                    <small className="text-[11px] text-[#899596]">{item.symbol} · {item.chainLabel}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function IfElseCanvas({
  block,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  block: IfElseBlock;
  open: boolean;
  onToggle: () => void;
  onChange: (block: IfElseBlock) => void;
  onRemove: () => void;
}) {
  function setLeft(left: ConditionSide) {
    onChange({ ...block, condition: { ...block.condition, left } });
  }
  function setRight(right: ConditionSide) {
    onChange({ ...block, condition: { ...block.condition, right } });
  }
  return (
    <div className="relative flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-block="condition"
          onClick={onToggle}
          className="flex items-center gap-2 rounded-full bg-[#bfe6f5] px-3 py-2 text-left text-[13px] font-semibold whitespace-nowrap text-[#16323d]"
        >
          <GitBranch size={14} className="shrink-0" />
          {formatConditionChip(block.condition)} ▾
        </button>
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-full border border-[#3a2a2a] text-[#f0b3a5]"
          aria-label="Remove condition"
          onClick={onRemove}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open ? (
        <div className="z-20 w-[min(420px,calc(100vw-3rem))] rounded-2xl border border-line bg-ink-2 p-4">
          <p className="mb-3 text-[13px] font-semibold">Edit conditional</p>
          <div className="grid grid-cols-[28px_minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-x-2 gap-y-3">
            <span className="text-[12px] text-[#899596]">if</span>
            <MiniSelect
              value={fnIdOf(block.condition.left)}
              placeholder="Choose function"
              title="Select function"
              options={fnOptions}
              onChange={(fn) => setLeft(sideFromFn(fn, 'ETH', block.condition.left))}
            />
            {block.condition.left.kind === 'fixed' ? (
              <>
                <span />
                <ValueSlot side={block.condition.left} onChange={setLeft} />
              </>
            ) : (
              <>
                <span className="text-[12px] text-[#899596]">of</span>
                <AssetSlot side={block.condition.left} onChange={setLeft} />
              </>
            )}
            <span className="text-[12px] text-[#899596]">is</span>
            <MiniSelect
              value={block.condition.comparator}
              placeholder="greater"
              title="Select comparator"
              options={comparatorOptions}
              onChange={(comparator: Comparator) => onChange({
                ...block,
                condition: { ...block.condition, comparator },
              })}
            />
            <span className="text-[12px] text-[#899596]">than</span>
            <MiniSelect
              value={fnIdOf(block.condition.right)}
              placeholder="Choose function"
              title="Select function"
              options={fnOptions}
              onChange={(fn) => setRight(sideFromFn(fn, 'ETH', block.condition.right))}
            />
            {block.condition.right.kind === 'fixed' ? (
              <>
                <span />
                <span />
                <span />
                <ValueSlot side={block.condition.right} onChange={setRight} />
              </>
            ) : (
              <>
                <span className="text-[12px] text-[#899596]">of</span>
                <AssetSlot side={block.condition.right} onChange={setRight} />
                <span />
                <span />
              </>
            )}
          </div>
        </div>
      ) : null}

      <div data-block="then-asset">
        <SelectBlock
          label="Then"
          assets={block.thenAssets}
          onChange={(thenAssets) => onChange({ ...block, thenAssets })}
        />
      </div>
      <span className="text-[12px] text-[#899596]">Else</span>
      <div data-block="else-asset">
        <SelectBlock
          label="Else"
          assets={block.elseAssets}
          onChange={(elseAssets) => onChange({ ...block, elseAssets })}
        />
      </div>
    </div>
  );
}
