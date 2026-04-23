import { useEffect, useMemo, useState } from 'react';
import { API, showError, showSuccess } from '../../../../helpers';

export const PAGE_SIZE = 10;
export const PRICE_SUFFIX = '$/1M tokens';
const EMPTY_CANDIDATE_MODEL_NAMES = [];

const EMPTY_MODEL = {
  name: '',
  billingMode: 'per-token',
  fixedPrice: '',
  inputPrice: '',
  outputPrice: '',
  cacheReadPrice: '',
  cacheWritePrice: '',
  imagePrice: '',
  hasConfiguration: false,
};

const NUMERIC_INPUT_REGEX = /^(\d+(\.\d*)?|\.\d*)?$/;

export const hasValue = (value) =>
  value !== '' && value !== null && value !== undefined && value !== false;

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

const buildModelState = (name, modelPriceMap) => {
  const storedPrice = modelPriceMap[name] || {};
  const perCallPrice = toNormalizedNumber(storedPrice.per_call_price);
  const promptPrice = toNormalizedNumber(storedPrice.prompt_price);
  const completionPrice = toNormalizedNumber(storedPrice.completion_price);
  const cacheReadPrice = toNormalizedNumber(storedPrice.cache_read_price);
  const cacheWritePrice = toNormalizedNumber(storedPrice.cache_write_price);
  const imagePrice = toNormalizedNumber(storedPrice.image_price);
  return {
    ...EMPTY_MODEL,
    name,
    billingMode: perCallPrice !== null ? 'per-request' : 'per-token',
    fixedPrice: perCallPrice !== null ? formatNumber(perCallPrice) : '',
    inputPrice: promptPrice !== null ? formatNumber(promptPrice) : '',
    outputPrice: completionPrice !== null ? formatNumber(completionPrice) : '',
    cacheReadPrice: cacheReadPrice !== null ? formatNumber(cacheReadPrice) : '',
    cacheWritePrice: cacheWritePrice !== null ? formatNumber(cacheWritePrice) : '',
    imagePrice: imagePrice !== null ? formatNumber(imagePrice) : '',
    hasConfiguration:
      perCallPrice !== null || promptPrice !== null || completionPrice !== null || cacheReadPrice !== null || cacheWritePrice !== null || imagePrice !== null,
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
    return `${t('固定价格')} $${model.fixedPrice} / ${t('次')}`;
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
    return [
      {
        key: 'ModelPrice',
        label: t('固定价格'),
        value: hasValue(model.fixedPrice) ? `$${model.fixedPrice} / ${t('次')}` : t('空'),
      },
    ];
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
    const modelPriceMap = parseOptionJSON(options.ModelPrice);
    const configuredNames = Object.keys(modelPriceMap);
    const names = new Set([
      ...candidateModelNames
        .map((n) => (typeof n === 'string' ? n : n.id))
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
    upsertModel(selectedModel.name, (model) => ({
      ...model,
      billingMode: value,
      fixedPrice: value === 'per-request' ? model.fixedPrice : '',
      inputPrice: value === 'per-token' ? model.inputPrice : '',
      outputPrice: value === 'per-token' ? model.outputPrice : '',
      cacheReadPrice: value === 'per-token' ? model.cacheReadPrice : '',
      cacheWritePrice: value === 'per-token' ? model.cacheWritePrice : '',
      imagePrice: value === 'per-token' ? model.imagePrice : '',
      hasConfiguration:
        value === 'per-request'
          ? hasValue(model.fixedPrice)
          : hasValue(model.inputPrice) || hasValue(model.outputPrice) || hasValue(model.cacheReadPrice) || hasValue(model.cacheWritePrice) || hasValue(model.imagePrice),
    }));
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
          inputPrice: selectedModel.inputPrice,
          outputPrice: selectedModel.outputPrice,
          cacheReadPrice: selectedModel.cacheReadPrice,
          cacheWritePrice: selectedModel.cacheWritePrice,
          imagePrice: selectedModel.imagePrice,
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
            output.ModelPrice[model.name] = {
              per_call_price: fixedPrice,
              use_per_call_pricing: true,
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
    handleSubmit,
    addModel,
    deleteModel,
    applySelectedModelPricing,
  };
}
