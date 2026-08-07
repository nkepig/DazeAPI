import { useEffect, useMemo, useState } from 'react';
import { API, showError, showSuccess } from '../../../../helpers';

export const PAGE_SIZE = 10;
export const PRICE_SUFFIX = '$/1M tokens';
const EMPTY_CANDIDATE_MODEL_NAMES = [];

const EMPTY_MODEL = {
  name: '',
  billingMode: 'per-token',
  fixedPrice: '',
  fixedPriceUnit: 'call',
  inputPrice: '',
  outputPrice: '',
  cacheReadPrice: '',
  cacheWritePrice: '',
  imagePrice: '',
  tiers: [],
  hasConfiguration: false,
};

const EMPTY_TIER = {
  maxLen: '∞',
  inputPrice: '',
  outputPrice: '',
  cacheReadPrice: '',
  cacheWritePrice: '',
};

const UNLIMITED_MAX_LEN = '∞';
const NUMERIC_INPUT_REGEX = /^(\d+(\.\d*)?|\.\d*)?$/;
const MAX_LEN_INPUT_REGEX = /^(∞|(\d+(\.\d*)?|\.\d*)?)$/;

export const hasValue = (value) =>
  value !== '' && value !== null && value !== undefined && value !== false;

const isUnlimitedMaxLen = (value) =>
  value === '' || value === null || value === undefined || value === UNLIMITED_MAX_LEN;

const formatMaxLenDisplay = (value) =>
  isUnlimitedMaxLen(value) ? UNLIMITED_MAX_LEN : String(value);

const tierHasPrice = (tier) =>
  hasValue(tier?.inputPrice) ||
  hasValue(tier?.outputPrice) ||
  hasValue(tier?.cacheReadPrice) ||
  hasValue(tier?.cacheWritePrice);

const toNumberOrNull = (value) => {
  if (!hasValue(value) && value !== 0) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatNumber = (value) => {
  const num = toNumberOrNull(value);
  if (num === null) {
    return '';
  }
  return parseFloat(num.toFixed(12)).toString();
};

const toNormalizedNumber = (value) => {
  const formatted = formatNumber(value);
  return formatted === '' ? null : Number(formatted);
};

const parseOptionJSON = (rawValue) => {
  if (!rawValue || rawValue.trim() === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('JSON解析错误:', error);
    return {};
  }
};

const normalizeModelName = (name) => String(name || '').trim();

const dedupeModelPriceMap = (modelPriceMap) => {
  const deduped = {};
  Object.entries(modelPriceMap || {}).forEach(([name, value]) => {
    const normalizedName = normalizeModelName(name);
    if (!normalizedName) {
      return;
    }
    deduped[normalizedName] = value;
  });
  return deduped;
};

const buildModelState = (name, modelPriceMap) => {
  const storedPrice = modelPriceMap[name] || {};
  const perCallPrice = toNormalizedNumber(storedPrice.per_call_price);
  const fixedPriceUnit = storedPrice.fixed_price_unit === 'second' ? 'second' : 'call';
  const promptPrice = toNormalizedNumber(storedPrice.prompt_price);
  const completionPrice = toNormalizedNumber(storedPrice.completion_price);
  const cacheReadPrice = toNormalizedNumber(storedPrice.cache_read_price);
  const cacheWritePrice = toNormalizedNumber(storedPrice.cache_write_price);
  const imagePrice = toNormalizedNumber(storedPrice.image_price);
  const tiers = Array.isArray(storedPrice.tiers)
    ? storedPrice.tiers.map((tier) => ({
        maxLen: formatMaxLenDisplay(tier?.max_len),
        inputPrice:
          toNormalizedNumber(tier?.prompt_price) !== null
            ? formatNumber(tier.prompt_price)
            : '',
        outputPrice:
          toNormalizedNumber(tier?.completion_price) !== null
            ? formatNumber(tier.completion_price)
            : '',
        cacheReadPrice:
          toNormalizedNumber(tier?.cache_read_price) !== null
            ? formatNumber(tier.cache_read_price)
            : '',
        cacheWritePrice:
          toNormalizedNumber(tier?.cache_write_price) !== null
            ? formatNumber(tier.cache_write_price)
            : '',
      }))
    : [];
  const isTiered = storedPrice.billing_mode === 'tiered' && tiers.length > 0;
  return {
    ...EMPTY_MODEL,
    name,
    billingMode: perCallPrice !== null ? 'per-request' : isTiered ? 'tiered' : 'per-token',
    fixedPrice: perCallPrice !== null ? formatNumber(perCallPrice) : '',
    fixedPriceUnit,
    inputPrice: promptPrice !== null ? formatNumber(promptPrice) : '',
    outputPrice: completionPrice !== null ? formatNumber(completionPrice) : '',
    cacheReadPrice: cacheReadPrice !== null ? formatNumber(cacheReadPrice) : '',
    cacheWritePrice: cacheWritePrice !== null ? formatNumber(cacheWritePrice) : '',
    imagePrice: imagePrice !== null ? formatNumber(imagePrice) : '',
    tiers: isTiered ? tiers : [],
    hasConfiguration:
      perCallPrice !== null ||
      promptPrice !== null ||
      completionPrice !== null ||
      cacheReadPrice !== null ||
      cacheWritePrice !== null ||
      imagePrice !== null ||
      isTiered,
  };
};

export const isBasePricingUnset = (model) => !model.hasConfiguration;

export const getModelWarnings = (model, t) => {
  if (!model) {
    return [];
  }
  const warnings = [];

  if (
    model.billingMode === 'per-token' &&
    (hasValue(model.outputPrice) || hasValue(model.cacheReadPrice) || hasValue(model.cacheWritePrice) || hasValue(model.imagePrice)) &&
    !hasValue(model.inputPrice)
  ) {
    warnings.push(t('填写输出价格前，需要先填写输入价格。'));
  }

  return warnings;
};

export const buildSummaryText = (model, t) => {
  if (model.billingMode === 'per-request' && hasValue(model.fixedPrice)) {
    const unit = model.fixedPriceUnit === 'second' ? t('秒') : t('次');
    return `${t('固定价格')} $${model.fixedPrice} / ${unit}`;
  }

  if (model.billingMode === 'tiered') {
    const count = Array.isArray(model.tiers) ? model.tiers.length : 0;
    return count > 0
      ? `${t('动态阶梯')} · ${count} ${t('档')}`
      : t('动态阶梯（未配置）');
  }

  if (hasValue(model.inputPrice)) {
    const tags = [
      hasValue(model.outputPrice) ? `O ${model.outputPrice}` : '',
      hasValue(model.cacheReadPrice) ? `CR ${model.cacheReadPrice}` : '',
      hasValue(model.cacheWritePrice) ? `CW ${model.cacheWritePrice}` : '',
      hasValue(model.imagePrice) ? `IMG ${model.imagePrice}` : '',
    ].filter(Boolean).join(' · ');
    return tags ? `${t('输入')} ${model.inputPrice} · ${tags}` : `${t('输入')} ${model.inputPrice}`;
  }

  return t('未设置价格');
};

export const buildPreviewRows = (model, t) => {
  if (!model) return [];

  if (model.billingMode === 'per-request') {
    const unit = model.fixedPriceUnit === 'second' ? t('秒') : t('次');
    return [
      {
        key: 'ModelPrice',
        label: t('固定价格'),
        value: hasValue(model.fixedPrice) ? `$${model.fixedPrice} / ${unit}` : t('空'),
      },
    ];
  }

  if (model.billingMode === 'tiered') {
    const tiers = Array.isArray(model.tiers) ? model.tiers : [];
    if (tiers.length === 0) {
      return [{ key: 'tiers', label: t('阶梯套餐'), value: t('空') }];
    }
    return tiers.map((tier, index) => ({
      key: `tier-${index}`,
      label: `${t('档位')} ${index + 1}`,
      value: `≤${formatMaxLenDisplay(tier.maxLen)} · I ${tier.inputPrice || '-'} / O ${tier.outputPrice || '-'} / CR ${tier.cacheReadPrice || '-'} / CW ${tier.cacheWritePrice || '-'}`,
    }));
  }

  return [
    {
      key: 'InputPrice',
      label: t('输入价格'),
      value: hasValue(model.inputPrice) ? `$${model.inputPrice} / 1M tokens` : t('空'),
    },
    {
      key: 'OutputPrice',
      label: t('输出价格'),
      value: hasValue(model.outputPrice) ? `${model.outputPrice}` : t('空'),
    },
    {
      key: 'CacheReadPrice',
      label: t('缓存读取价格'),
      value: hasValue(model.cacheReadPrice) ? `${model.cacheReadPrice}` : t('空'),
    },
    {
      key: 'CacheWritePrice',
      label: t('缓存创建价格'),
      value: hasValue(model.cacheWritePrice) ? `${model.cacheWritePrice}` : t('空'),
    },
    {
      key: 'ImagePrice',
      label: t('图片输入价格'),
      value: hasValue(model.imagePrice) ? `${model.imagePrice}` : t('空'),
    },
  ];
};

export function useModelPricingEditorState({
  options,
  refresh,
  t,
  candidateModelNames = EMPTY_CANDIDATE_MODEL_NAMES,
  filterMode = 'all',
}) {
  const [models, setModels] = useState([]);
  const [initialVisibleModelNames, setInitialVisibleModelNames] = useState([]);
  const [selectedModelName, setSelectedModelName] = useState('');
  const [selectedModelNames, setSelectedModelNames] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(filterMode === 'unset' ? 'unset' : 'all');

  useEffect(() => {
    const modelPriceMap = dedupeModelPriceMap(parseOptionJSON(options.ModelPrice));
    const configuredNames = Object.keys(modelPriceMap);
    const names = new Set([
      ...candidateModelNames
        .map((n) => normalizeModelName(typeof n === 'string' ? n : n.id))
        .filter(Boolean),
      ...configuredNames.filter(Boolean),
    ]);

    const nextModels = Array.from(names)
      .map((name) => buildModelState(name, modelPriceMap))
      .sort((a, b) => a.name.localeCompare(b.name));

    setModels(nextModels);
    setInitialVisibleModelNames(
      filterMode === 'unset'
        ? nextModels
            .filter((model) => isBasePricingUnset(model))
            .map((model) => model.name)
        : nextModels.map((model) => model.name),
    );
    setSelectedModelName((previous) => {
      if (previous && nextModels.some((model) => model.name === previous)) {
        return previous;
      }
      const nextVisibleModels =
        filterMode === 'unset'
          ? nextModels.filter((model) => isBasePricingUnset(model))
          : nextModels;
      return nextVisibleModels[0]?.name || '';
    });
  }, [candidateModelNames, filterMode, options]);

  const visibleModels = useMemo(() => {
    let base =
      filterMode === 'unset'
        ? models.filter((model) => initialVisibleModelNames.includes(model.name))
        : models;

    if (statusFilter === 'configured') {
      base = base.filter((model) => model.hasConfiguration);
    } else if (statusFilter === 'unset') {
      base = base.filter((model) => !model.hasConfiguration);
    }

    // Ensure the currently selected/edited model remains visible even if its
    // transient hasConfiguration state does not match the current filter.
    // This prevents the selected model from disappearing or jumping while
    // typing in its fields (a bug reported when statusFilter is
    // configured/unset).
    if (selectedModelName) {
      const isInBase = base.some((m) => m.name === selectedModelName);
      if (!isInBase) {
        const selectedFromModels = models.find((m) => m.name === selectedModelName);
        if (selectedFromModels) {
          base = [selectedFromModels, ...base];
        }
      }
    }

    return base;
  }, [filterMode, initialVisibleModelNames, models, statusFilter, selectedModelName]);

  const filteredModels = useMemo(() => {
    return visibleModels.filter((model) => {
      const keyword = searchText.trim().toLowerCase();
      const keywordMatch = keyword
        ? model.name.toLowerCase().includes(keyword)
        : true;
      return keywordMatch;
    });
  }, [searchText, visibleModels]);

  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredModels.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredModels]);

  const selectedModel = useMemo(
    () => visibleModels.find((model) => model.name === selectedModelName) || null,
    [selectedModelName, visibleModels],
  );

  const selectedWarnings = useMemo(
    () => getModelWarnings(selectedModel, t),
    [selectedModel, t],
  );

  const previewRows = useMemo(
    () => buildPreviewRows(selectedModel, t),
    [selectedModel, t],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterMode, candidateModelNames, statusFilter]);

  useEffect(() => {
    setSelectedModelNames((previous) =>
      previous.filter((name) => visibleModels.some((model) => model.name === name)),
    );
  }, [visibleModels]);

  useEffect(() => {
    if (visibleModels.length === 0) {
      setSelectedModelName('');
      return;
    }
    if (!visibleModels.some((model) => model.name === selectedModelName)) {
      setSelectedModelName(visibleModels[0].name);
    }
  }, [selectedModelName, visibleModels]);

  const upsertModel = (name, updater) => {
    setModels((previous) =>
      previous.map((model) => {
        if (model.name !== name) return model;
        return typeof updater === 'function' ? updater(model) : updater;
      }),
    );
  };

  const handleNumericFieldChange = (field, value) => {
    if (!selectedModel || !NUMERIC_INPUT_REGEX.test(value)) {
      return;
    }

    upsertModel(selectedModel.name, (model) => {
      const updatedModel = { ...model, [field]: value };
      if (field === 'fixedPrice') {
        updatedModel.hasConfiguration = hasValue(value);
      }
      if (['inputPrice', 'outputPrice', 'cacheReadPrice', 'cacheWritePrice', 'imagePrice'].includes(field)) {
        updatedModel.hasConfiguration =
          hasValue(updatedModel.inputPrice) || hasValue(updatedModel.outputPrice) || hasValue(updatedModel.cacheReadPrice) || hasValue(updatedModel.cacheWritePrice) || hasValue(updatedModel.imagePrice);
      }
      return updatedModel;
    });
  };

  const handleBillingModeChange = (value) => {
    if (!selectedModel) return;
    upsertModel(selectedModel.name, (model) => {
      const next = {
        ...model,
        billingMode: value,
        fixedPrice: value === 'per-request' ? model.fixedPrice : '',
        fixedPriceUnit: value === 'per-request' ? (model.fixedPriceUnit || 'call') : 'call',
        inputPrice: value === 'per-token' ? model.inputPrice : '',
        outputPrice: value === 'per-token' ? model.outputPrice : '',
        cacheReadPrice: value === 'per-token' ? model.cacheReadPrice : '',
        cacheWritePrice: value === 'per-token' ? model.cacheWritePrice : '',
        imagePrice: value === 'per-token' ? model.imagePrice : '',
        tiers:
          value === 'tiered'
            ? model.tiers?.length
              ? model.tiers
              : [
                  { ...EMPTY_TIER, maxLen: '128000' },
                  { ...EMPTY_TIER, maxLen: UNLIMITED_MAX_LEN },
                ]
            : [],
      };
      if (value === 'per-request') {
        next.hasConfiguration = hasValue(next.fixedPrice);
      } else if (value === 'tiered') {
        next.hasConfiguration = (next.tiers || []).some(tierHasPrice);
      } else {
        next.hasConfiguration =
          hasValue(next.inputPrice) ||
          hasValue(next.outputPrice) ||
          hasValue(next.cacheReadPrice) ||
          hasValue(next.cacheWritePrice) ||
          hasValue(next.imagePrice);
      }
      return next;
    });
  };

  const handleFixedPriceUnitChange = (value) => {
    if (!selectedModel) return;
    upsertModel(selectedModel.name, (model) => ({
      ...model,
      fixedPriceUnit: value,
    }));
  };

  const handleTierChange = (index, field, value) => {
    if (!selectedModel) return;
    if (field === 'maxLen') {
      if (!MAX_LEN_INPUT_REGEX.test(value)) {
        return;
      }
    } else if (
      ['inputPrice', 'outputPrice', 'cacheReadPrice', 'cacheWritePrice'].includes(field) &&
      !NUMERIC_INPUT_REGEX.test(value)
    ) {
      return;
    }
    upsertModel(selectedModel.name, (model) => {
      const tiers = (model.tiers || []).map((tier, i) =>
        i === index ? { ...tier, [field]: value } : tier,
      );
      return {
        ...model,
        tiers,
        hasConfiguration: tiers.some(tierHasPrice),
      };
    });
  };

  const addTier = () => {
    if (!selectedModel) return;
    upsertModel(selectedModel.name, (model) => ({
      ...model,
      tiers: [...(model.tiers || []), { ...EMPTY_TIER }],
    }));
  };

  const removeTier = (index) => {
    if (!selectedModel) return;
    upsertModel(selectedModel.name, (model) => {
      const tiers = (model.tiers || []).filter((_, i) => i !== index);
      return {
        ...model,
        tiers,
        hasConfiguration: tiers.some(tierHasPrice),
      };
    });
  };

  const addModel = (modelName) => {
    const trimmedName = modelName.trim();
    if (!trimmedName) {
      showError(t('请输入模型名称'));
      return false;
    }
    if (models.some((model) => model.name === trimmedName)) {
      showError(t('模型名称已存在'));
      return false;
    }

    const nextModel = {
      ...EMPTY_MODEL,
      name: trimmedName,
    };

    setModels((previous) => [nextModel, ...previous]);
    setSelectedModelName(trimmedName);
    setCurrentPage(1);
    return true;
  };

  const deleteModel = (name) => {
    const nextModels = models.filter((model) => model.name !== name);
    setModels(nextModels);
    setSelectedModelNames((previous) => previous.filter((item) => item !== name));
    if (selectedModelName === name) {
      setSelectedModelName(nextModels[0]?.name || '');
    }
  };

  const applySelectedModelPricing = () => {
    if (!selectedModel) {
      showError(t('请先选择一个作为模板的模型'));
      return false;
    }
    if (selectedModelNames.length === 0) {
      showError(t('请先勾选需要批量设置的模型'));
      return false;
    }

    setModels((previous) =>
      previous.map((model) => {
        if (!selectedModelNames.includes(model.name)) {
          return model;
        }

        return {
          ...model,
          billingMode: selectedModel.billingMode,
          fixedPrice: selectedModel.fixedPrice,
          fixedPriceUnit: selectedModel.fixedPriceUnit,
          inputPrice: selectedModel.inputPrice,
          outputPrice: selectedModel.outputPrice,
          cacheReadPrice: selectedModel.cacheReadPrice,
          cacheWritePrice: selectedModel.cacheWritePrice,
          imagePrice: selectedModel.imagePrice,
          tiers: selectedModel.tiers || [],
          hasConfiguration: selectedModel.hasConfiguration,
        };
      }),
    );

    showSuccess(
      t('已将模型 {{name}} 的价格配置批量应用到 {{count}} 个模型', {
        name: selectedModel.name,
        count: selectedModelNames.length,
      }),
    );
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const output = {
        ModelPrice: {},
      };

      for (const model of models) {
        if (model.billingMode === 'per-request') {
          const fixedPrice = toNormalizedNumber(model.fixedPrice);
          if (fixedPrice !== null) {
            const fixedPriceUnit = model.fixedPriceUnit === 'second' ? 'second' : 'call';
            output.ModelPrice[model.name] = {
              per_call_price: fixedPrice,
              use_per_call_pricing: true,
              fixed_price_unit: fixedPriceUnit,
            };
          }
          continue;
        }

        if (model.billingMode === 'tiered') {
          const tiers = (model.tiers || [])
            .map((tier) => {
              const inputPrice = toNormalizedNumber(tier.inputPrice);
              const outputPrice = toNormalizedNumber(tier.outputPrice);
              const cacheReadPrice = toNormalizedNumber(tier.cacheReadPrice);
              const cacheWritePrice = toNormalizedNumber(tier.cacheWritePrice);
              const maxLen = isUnlimitedMaxLen(tier.maxLen)
                ? null
                : toNormalizedNumber(tier.maxLen);
              if (!tierHasPrice(tier) && maxLen === null) {
                return null;
              }
              const item = {
                prompt_price: inputPrice ?? 0,
                completion_price: outputPrice ?? inputPrice ?? 0,
                cache_read_price: cacheReadPrice ?? 0,
                cache_write_price: cacheWritePrice ?? 0,
              };
              if (maxLen !== null) {
                item.max_len = Math.trunc(maxLen);
              }
              return item;
            })
            .filter(Boolean);
          if (tiers.length > 0) {
            const first = tiers[0];
            output.ModelPrice[model.name] = {
              billing_mode: 'tiered',
              tiers,
              // 兼容展示：用第一档单价作为默认价
              prompt_price: first.prompt_price ?? 0,
              completion_price: first.completion_price ?? 0,
              cache_read_price: first.cache_read_price ?? 0,
              cache_write_price: first.cache_write_price ?? 0,
            };
          }
          continue;
        }

        const inputPrice = toNormalizedNumber(model.inputPrice);
        const outputPrice = toNormalizedNumber(model.outputPrice);
        const cacheReadPrice = toNormalizedNumber(model.cacheReadPrice);
        const cacheWritePrice = toNormalizedNumber(model.cacheWritePrice);
        const imagePrice = toNormalizedNumber(model.imagePrice);
        if (inputPrice !== null || outputPrice !== null || cacheReadPrice !== null || cacheWritePrice !== null || imagePrice !== null) {
          output.ModelPrice[model.name] = {
            prompt_price: inputPrice ?? 0,
            completion_price: outputPrice ?? inputPrice ?? 0,
            cache_read_price: cacheReadPrice ?? 0,
            cache_write_price: cacheWritePrice ?? 0,
            image_price: imagePrice ?? 0,
          };
        }
      }

      const results = await Promise.all([
        API.put('/api/option/', {
          key: 'ModelPrice',
          value: JSON.stringify(output.ModelPrice, null, 2),
        }),
      ]);
      for (const res of results) {
        if (!res?.data?.success) {
          throw new Error(res?.data?.message || t('保存失败，请重试'));
        }
      }

      showSuccess(t('保存成功'));
      await refresh();
    } catch (error) {
      console.error('保存失败:', error);
      showError(error.message || t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return {
    models,
    selectedModel,
    selectedModelName,
    selectedModelNames,
    setSelectedModelName,
    setSelectedModelNames,
    searchText,
    setSearchText,
    currentPage,
    setCurrentPage,
    loading,
    statusFilter,
    setStatusFilter,
    filteredModels,
    pagedData,
    selectedWarnings,
    previewRows,
    isOptionalFieldEnabled: () => true,
    handleOptionalFieldToggle: () => {},
    handleNumericFieldChange,
    handleBillingModeChange,
    handleFixedPriceUnitChange,
    handleTierChange,
    addTier,
    removeTier,
    handleSubmit,
    addModel,
    deleteModel,
    applySelectedModelPricing,
  };
}
