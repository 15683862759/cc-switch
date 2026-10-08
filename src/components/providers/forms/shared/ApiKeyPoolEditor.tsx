import React, { useRef, useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ApiKeyEntry, ApiKeyStrategy, ProviderCategory } from "@/types";
import { splitApiKeyText } from "@/utils/apiKeyPool";
import { REQUIRED_LABEL } from "../BasicFormFields";

interface ApiKeyPoolEditorProps {
  id?: string;
  label: string;
  entries: ApiKeyEntry[];
  strategy: ApiKeyStrategy;
  onChange: (entries: ApiKeyEntry[]) => void;
  onStrategyChange: (strategy: ApiKeyStrategy) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  labelAside?: React.ReactNode;
  hint?: React.ReactNode;
  category?: ProviderCategory;
}

const weightInputClass =
  "h-8 w-20 rounded-md border border-border bg-surface px-2 text-right font-mono text-[13px] text-fg-1 outline-none transition-colors focus:border-fg-3 disabled:cursor-not-allowed disabled:opacity-50";

export function ApiKeyPoolEditor({
  id,
  label,
  entries,
  strategy,
  onChange,
  onStrategyChange,
  placeholder,
  disabled = false,
  required = false,
  labelAside,
  hint,
  category,
}: ApiKeyPoolEditorProps) {
  const { t } = useTranslation();
  const [showKeys, setShowKeys] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isDisabled = disabled || category === "official";

  const updateEntry = (index: number, patch: Partial<ApiKeyEntry>) => {
    if (isDisabled) return;
    onChange(
      entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const insertEmptyRow = (index: number) => {
    if (isDisabled) return;
    const next = [...entries];
    next.splice(index + 1, 0, { key: "", weight: 1 });
    onChange(next);
    requestAnimationFrame(() => inputRefs.current[index + 1]?.focus());
  };

  const removeRow = (index: number) => {
    if (isDisabled) return;
    const next = entries.filter((_, entryIndex) => entryIndex !== index);
    onChange(next.length > 0 ? next : [{ key: "", weight: 1 }]);
    requestAnimationFrame(() =>
      inputRefs.current[Math.max(0, index - 1)]?.focus(),
    );
  };

  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    if (isDisabled) return;
    const pasted = splitApiKeyText(event.clipboardData.getData("text"));
    if (pasted.length <= 1) return;

    event.preventDefault();
    const replacement = pasted.map((key) => ({
      key,
      weight: entries[index]?.weight ?? 1,
    }));
    const next = [
      ...entries.slice(0, index),
      ...replacement,
      ...entries.slice(index + 1),
    ];
    onChange(next);
    requestAnimationFrame(() =>
      inputRefs.current[index + replacement.length - 1]?.focus(),
    );
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      insertEmptyRow(index);
      return;
    }
    if (
      event.key === "Backspace" &&
      entries[index]?.key === "" &&
      entries.length > 1
    ) {
      event.preventDefault();
      removeRow(index);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className={cn(
            "block text-caption font-medium text-fg-1",
            required && REQUIRED_LABEL,
          )}
        >
          {label}
        </label>
        <div className="flex items-center gap-2">
          {labelAside}
          {!isDisabled && (
            <button
              type="button"
              onClick={() => setShowKeys((value) => !value)}
              className="text-fg-3 transition-colors hover:text-fg-1"
              aria-label={
                showKeys
                  ? t("apiKeyInput.hide", { defaultValue: "隐藏 Key" })
                  : t("apiKeyInput.show", { defaultValue: "显示 Key" })
              }
            >
              {showKeys ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {entries.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              id={index === 0 ? id : undefined}
              type={showKeys ? "text" : "password"}
              value={entry.key}
              onChange={(event) =>
                updateEntry(index, { key: event.target.value })
              }
              onPaste={(event) => handlePaste(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              placeholder={
                index === 0
                  ? (placeholder ?? t("apiKeyInput.placeholder"))
                  : t("apiKeyInput.nextKeyPlaceholder", {
                      defaultValue: "继续输入或粘贴 API Key",
                    })
              }
              disabled={isDisabled}
              aria-required={required || undefined}
              autoComplete="off"
              className={cn(
                fieldClass,
                "h-8 min-w-0 flex-1 pe-3 font-mono text-[13px]",
                isDisabled && "border-border bg-subtle text-fg-3 opacity-100",
              )}
            />
            {strategy === "weighted" && (
              <input
                type="number"
                min={1}
                step={1}
                value={entry.weight}
                onChange={(event) =>
                  updateEntry(index, {
                    weight: Math.max(1, Number(event.target.value) || 1),
                  })
                }
                disabled={isDisabled}
                aria-label={t("apiKeyInput.weightLabel", {
                  defaultValue: "Key 权重",
                })}
                className={weightInputClass}
              />
            )}
            {!isDisabled && entries.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-subtle hover:text-danger-text"
                aria-label={t("apiKeyInput.removeKey", {
                  defaultValue: "删除这个 Key",
                })}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-start justify-between gap-3">
        <p className="text-caption leading-5 text-fg-2">
          {t("apiKeyInput.multiHint", {
            defaultValue:
              "回车换行，每行一个 API Key；粘贴多个 Key 会自动拆分。",
          })}
        </p>
        {!isDisabled && (
          <button
            type="button"
            onClick={() => insertEmptyRow(entries.length - 1)}
            className="inline-flex shrink-0 items-center gap-1 text-caption text-fg-1 transition-colors hover:text-fg-2"
          >
            <Plus size={13} />
            {t("apiKeyInput.addKey", { defaultValue: "添加 Key" })}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-subtle/50 px-3 py-2">
        <div>
          <div className="text-caption font-medium text-fg-1">
            {t("apiKeyInput.strategy", { defaultValue: "Key 调度策略" })}
          </div>
          <div className="text-[11px] text-fg-3">
            {t("apiKeyInput.strategyRouteHint", {
              defaultValue: "随机、轮询、权重仅在本地路由/聚合模式生效",
            })}
          </div>
        </div>
        <select
          value={strategy}
          onChange={(event) =>
            onStrategyChange(event.target.value as ApiKeyStrategy)
          }
          disabled={isDisabled}
          className="h-8 rounded-md border border-border bg-surface px-2 text-caption text-fg-1 outline-none transition-colors focus:border-fg-3 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t("apiKeyInput.strategy", {
            defaultValue: "Key 调度策略",
          })}
        >
          <option value="random">
            {t("apiKeyInput.strategyRandom", { defaultValue: "随机" })}
          </option>
          <option value="round_robin">
            {t("apiKeyInput.strategyRoundRobin", { defaultValue: "轮询" })}
          </option>
          <option value="weighted">
            {t("apiKeyInput.strategyWeighted", { defaultValue: "权重" })}
          </option>
        </select>
      </div>

      {strategy === "weighted" && !isDisabled && (
        <p className="text-caption text-fg-2">
          {t("apiKeyInput.weightHint", {
            defaultValue: "权重留空或小于 1 时按 1 处理。",
          })}
        </p>
      )}
      {hint && <p className="text-caption text-fg-2">{hint}</p>}
    </div>
  );
}
