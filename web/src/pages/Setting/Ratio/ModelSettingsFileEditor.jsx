/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
import { Button, Card, Modal, Space, Typography } from '@douyinfe/semi-ui';
import { IconSave, IconCode, IconPlus } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';

const { Text } = Typography;

const wrapModelEntriesInput = (rawText) => {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    return '{}';
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const content = trimmed.replace(/^,+\s*/, '').replace(/,\s*$/, '');
  return `{\n${content}\n}`;
};

const MISSING_VALUE = '__DAZEAPI_MISSING__';

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sortJsonValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc, key) => {
        acc[key] = sortJsonValue(value[key]);
        return acc;
      }, {});
  }
  return value;
};

const stringifyPrettyJson = (value) => JSON.stringify(sortJsonValue(value), null, 2);

const getComparableValueText = (value) => {
  if (value === MISSING_VALUE) {
    return '<missing>';
  }
  return JSON.stringify(sortJsonValue(value));
};

const collectDiffPaths = (leftValue, rightValue, path = '') => {
  const diffPaths = new Set();

  if (isPlainObject(leftValue) && isPlainObject(rightValue)) {
    const keys = Array.from(
      new Set([...Object.keys(leftValue), ...Object.keys(rightValue)]),
    ).sort((a, b) => a.localeCompare(b));

    keys.forEach((key) => {
      const nextPath = path ? `${path}.${key}` : key;
      const leftHas = Object.prototype.hasOwnProperty.call(leftValue, key);
      const rightHas = Object.prototype.hasOwnProperty.call(rightValue, key);

      if (!leftHas || !rightHas) {
        diffPaths.add(nextPath);
        return;
      }

      collectDiffPaths(leftValue[key], rightValue[key], nextPath).forEach((item) =>
        diffPaths.add(item),
      );
    });

    return diffPaths;
  }

  if (getComparableValueText(leftValue) !== getComparableValueText(rightValue)) {
    diffPaths.add(path || '__root__');
  }

  return diffPaths;
};

const pathHasDiff = (diffPaths, currentPath) => {
  if (!currentPath) {
    return diffPaths.has('__root__');
  }
  return Array.from(diffPaths).some(
    (path) => path === currentPath || path.startsWith(`${currentPath}.`),
  );
};

const renderComparisonValue = ({
  currentValue,
  otherValue,
  diffPaths,
  side,
  level = 0,
  path = '',
}) => {
  const baseIndent = level * 16;
  const lineStyle = {
    marginTop: 6,
    padding: '6px 8px',
    borderRadius: 6,
    marginLeft: baseIndent,
  };

  if (isPlainObject(currentValue) || isPlainObject(otherValue)) {
    const currentObject = isPlainObject(currentValue) ? currentValue : {};
    const otherObject = isPlainObject(otherValue) ? otherValue : {};
    const keys = Array.from(
      new Set([...Object.keys(currentObject), ...Object.keys(otherObject)]),
    ).sort((a, b) => a.localeCompare(b));

    return (
      <>
        <div style={{ ...lineStyle, marginTop: 0 }}>{'{'}</div>
        {keys.map((key) => {
          const currentPath = path ? `${path}.${key}` : key;
          const currentHas = Object.prototype.hasOwnProperty.call(currentObject, key);
          const otherHas = Object.prototype.hasOwnProperty.call(otherObject, key);
          const nextCurrentValue = currentHas ? currentObject[key] : MISSING_VALUE;
          const nextOtherValue = otherHas ? otherObject[key] : MISSING_VALUE;
          const hasDiff = pathHasDiff(diffPaths, currentPath);
          const isMissing = nextCurrentValue === MISSING_VALUE;

          if (
            nextCurrentValue !== MISSING_VALUE &&
            (isPlainObject(nextCurrentValue) || isPlainObject(nextOtherValue))
          ) {
            return (
              <div
                key={currentPath}
                style={{
                  ...lineStyle,
                  background: hasDiff
                    ? side === 'left'
                      ? 'rgba(245, 158, 11, 0.12)'
                      : 'rgba(59, 130, 246, 0.12)'
                    : 'transparent',
                  border: hasDiff
                    ? `1px solid ${
                        side === 'left' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(59, 130, 246, 0.35)'
                      }`
                    : '1px solid transparent',
                }}
              >
                <div>{`"${key}": {`}</div>
                {renderComparisonValue({
                  currentValue: nextCurrentValue,
                  otherValue: nextOtherValue,
                  diffPaths,
                  side,
                  level: level + 1,
                  path: currentPath,
                })}
                <div style={{ marginLeft: 16 }}>{'}'}</div>
              </div>
            );
          }

          return (
            <div
              key={currentPath}
              style={{
                ...lineStyle,
                background: hasDiff
                  ? isMissing
                    ? 'rgba(239, 68, 68, 0.12)'
                    : side === 'left'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(59, 130, 246, 0.12)'
                  : 'transparent',
                border: hasDiff
                  ? `1px solid ${
                      isMissing
                        ? 'rgba(239, 68, 68, 0.35)'
                        : side === 'left'
                        ? 'rgba(245, 158, 11, 0.35)'
                        : 'rgba(59, 130, 246, 0.35)'
                    }`
                  : '1px solid transparent',
                color: isMissing ? 'var(--semi-color-danger)' : 'inherit',
              }}
            >
              {`"${key}": ${getComparableValueText(nextCurrentValue)}`}
            </div>
          );
        })}
        <div style={{ ...lineStyle, marginTop: 6 }}>{'}'}</div>
      </>
    );
  }

  return <div style={lineStyle}>{getComparableValueText(currentValue)}</div>;
};

const sortModelPriceObject = (obj) => {
  const sortedEntries = Object.entries(obj || {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return Object.fromEntries(
    sortedEntries.map(([key, value]) => [key, sortJsonValue(value)]),
  );
};

const normalizeModelPriceJson = (rawText) => {
  const parsed = rawText.trim() ? JSON.parse(rawText) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid-model-price-json');
  }

  const normalized = {};
  let trimmedKeyCount = 0;
  let mergedDuplicateCount = 0;
  let emptyKeyCount = 0;

  Object.entries(parsed).forEach(([modelName, value]) => {
    const rawModelName = String(modelName || '');
    const normalizedName = rawModelName.trim();
    if (!normalizedName) {
      emptyKeyCount += 1;
      return;
    }
    if (rawModelName !== normalizedName) {
      trimmedKeyCount += 1;
    }
    if (
      Object.prototype.hasOwnProperty.call(normalized, normalizedName)
    ) {
      mergedDuplicateCount += 1;
    }
    normalized[normalizedName] = value;
  });

  return {
    normalized: sortModelPriceObject(normalized),
    stats: {
      trimmedKeyCount,
      mergedDuplicateCount,
      emptyKeyCount,
    },
  };
};

const stringifyModelPriceJson = (rawText) => {
  const { normalized, stats } = normalizeModelPriceJson(rawText);
  return {
    text: stringifyPrettyJson(normalized),
    stats,
  };
};

const notifyNormalization = (stats, t) => {
  const changedCount =
    stats.trimmedKeyCount + stats.mergedDuplicateCount + stats.emptyKeyCount;
  if (changedCount <= 0) {
    return;
  }

  showInfo(
    t('已自动清理模型名：去除空白 {{trimmed}}, 合并重复 {{merged}}, 删除空键 {{empty}}', {
      trimmed: stats.trimmedKeyCount,
      merged: stats.mergedDuplicateCount,
      empty: stats.emptyKeyCount,
    }),
  );
};

export default function ModelSettingsFileEditor({ options, refresh }) {
  const { t } = useTranslation();
  const [jsonText, setJsonText] = useState('');
  const [appendJsonText, setAppendJsonText] = useState('');
  const [pendingMerge, setPendingMerge] = useState(null);
  const [pendingConflictIndex, setPendingConflictIndex] = useState(0);
  const [showAppendModal, setShowAppendModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = options.ModelPrice || '{}';
    try {
      setJsonText(stringifyModelPriceJson(raw).text);
      setPendingMerge(null);
      setPendingConflictIndex(0);
    } catch {
      setJsonText(raw);
    }
  }, [options.ModelPrice]);

  const handleFormat = () => {
    try {
      const { text, stats } = stringifyModelPriceJson(jsonText);
      setJsonText(text);
      notifyNormalization(stats, t);
      showSuccess(t('格式化成功'));
    } catch {
      showError(t('JSON 格式错误，无法格式化'));
    }
  };

  const handleAppendModels = () => {
    if (!appendJsonText.trim()) {
      showError(t('请输入需要添加的模型 JSON'));
      return;
    }

    try {
      const appendWrappedText = wrapModelEntriesInput(appendJsonText);
      const { normalized: currentNormalized, stats: currentStats } =
        normalizeModelPriceJson(jsonText);
      const { normalized: appendNormalized, stats: appendStats } =
        normalizeModelPriceJson(appendWrappedText);

      const duplicateNames = Object.keys(appendNormalized).filter((name) =>
        Object.prototype.hasOwnProperty.call(currentNormalized, name),
      );

      const skippedIdenticalNames = [];
      const conflicts = [];
      const mergedBase = { ...currentNormalized };

      Object.entries(appendNormalized).forEach(([name, value]) => {
        if (!Object.prototype.hasOwnProperty.call(currentNormalized, name)) {
          mergedBase[name] = value;
          return;
        }

        if (
          stringifyPrettyJson(currentNormalized[name]) === stringifyPrettyJson(value)
        ) {
          skippedIdenticalNames.push(name);
          return;
        }

        conflicts.push({
          name,
          leftValue: currentNormalized[name],
          rightValue: value,
          selectedSide: null,
        });
      });

      if (skippedIdenticalNames.length > 0) {
        showInfo(
          t('有 {{count}} 个完全相同的重复模型已自动跳过：{{names}}', {
            count: skippedIdenticalNames.length,
            names: skippedIdenticalNames.slice(0, 10).join(', '),
          }),
        );
      }

      if (conflicts.length > 0) {
        setShowAppendModal(false);
        setPendingMerge({
          baseMap: sortModelPriceObject(mergedBase),
          conflicts,
          skippedIdenticalNames,
          duplicateNames,
        });
        setPendingConflictIndex(0);
        showInfo(
          t('发现 {{count}} 个重复模型，请在下方逐项选择保留左侧还是右侧', {
            count: conflicts.length,
          }),
        );
        return;
      }

      const merged = sortModelPriceObject(mergedBase);

      setJsonText(stringifyPrettyJson(merged));
      setAppendJsonText('');
      setShowAppendModal(false);
      setPendingMerge(null);
      setPendingConflictIndex(0);

      notifyNormalization(
        {
          trimmedKeyCount:
            currentStats.trimmedKeyCount + appendStats.trimmedKeyCount,
          mergedDuplicateCount:
            currentStats.mergedDuplicateCount + appendStats.mergedDuplicateCount,
          emptyKeyCount: currentStats.emptyKeyCount + appendStats.emptyKeyCount,
        },
        t,
      );

      showSuccess(
        t('已添加 {{count}} 个模型，当前 JSON 已按模型名排序', {
          count: Object.keys(appendNormalized).length - skippedIdenticalNames.length,
        }),
      );
    } catch {
      showError(t('添加模型的 JSON 格式错误'));
    }
  };

  const handleConflictChoice = (modelName, selectedSide) => {
    setPendingMerge((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        conflicts: previous.conflicts.map((conflict) =>
          conflict.name === modelName
            ? { ...conflict, selectedSide }
            : conflict,
          ),
      };
    });

    setPendingConflictIndex((previousIndex) => {
      if (!pendingMerge) {
        return previousIndex;
      }
      return Math.min(previousIndex + 1, pendingMerge.conflicts.length - 1);
    });
  };

  const handleApplyConflictChoices = () => {
    if (!pendingMerge) {
      return;
    }

    const unresolvedConflicts = pendingMerge.conflicts.filter(
      (conflict) => !conflict.selectedSide,
    );
    if (unresolvedConflicts.length > 0) {
      showError(
        t('还有 {{count}} 个重复模型未选择保留哪一侧', {
          count: unresolvedConflicts.length,
        }),
      );
      return;
    }

    const resolved = { ...pendingMerge.baseMap };
    pendingMerge.conflicts.forEach((conflict) => {
      resolved[conflict.name] =
        conflict.selectedSide === 'left' ? conflict.leftValue : conflict.rightValue;
    });

    setJsonText(stringifyPrettyJson(sortModelPriceObject(resolved)));
    setAppendJsonText('');
    setPendingMerge(null);
    setPendingConflictIndex(0);
    setShowAppendModal(false);
    showSuccess(
      t('已处理 {{count}} 个重复模型冲突，并更新主 JSON', {
        count: pendingMerge.conflicts.length,
      }),
    );
  };

  const handleCancelConflictChoices = () => {
    setPendingMerge(null);
    setPendingConflictIndex(0);
    showWarning(t('已取消本次重复模型处理'));
  };

  const currentConflict = pendingMerge?.conflicts?.[pendingConflictIndex] || null;
  const currentConflictDiffPaths = currentConflict
    ? collectDiffPaths(currentConflict.leftValue, currentConflict.rightValue)
    : new Set();
  const isLastConflict = Boolean(pendingMerge) && pendingConflictIndex === pendingMerge.conflicts.length - 1;
  const hasUnresolvedConflicts = Boolean(
    pendingMerge?.conflicts?.some((conflict) => !conflict.selectedSide),
  );

  const handleSave = async () => {
    if (!verifyJSON(jsonText)) {
      showError(t('不是合法的 JSON 字符串'));
      return;
    }

    setLoading(true);
    try {
      const { text: normalizedText, stats } = stringifyModelPriceJson(jsonText);
      setJsonText(normalizedText);
      notifyNormalization(stats, t);
      const res = await API.put('/api/option/', {
        key: 'ModelPrice',
        value: normalizedText,
      });
      if (res.data.success) {
        showSuccess(t('保存成功'));
        await refresh();
      } else {
        showError(res.data.message || t('保存失败'));
      }
    } catch {
      showError(t('保存失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space vertical align='start' style={{ width: '100%' }}>
      <Space wrap className='mt-2'>
        <Button icon={<IconCode />} onClick={handleFormat}>
          {t('格式化 JSON')}
        </Button>
        <Button
          icon={<IconPlus />}
          onClick={() => setShowAppendModal(true)}
        >
          {t('添加模型')}
        </Button>
        <Button type='primary' icon={<IconSave />} loading={loading} onClick={handleSave}>
          {t('保存')}
        </Button>
      </Space>

      <Text size='small' type='tertiary'>
        {t('可直接编辑 ModelPrice JSON，也可在下方粘贴模型 JSON 批量追加；系统会自动提示重复、去重，并始终按模型名 A-Z 排序。')}
      </Text>

      {pendingMerge && (
        <Card style={{ width: '100%' }}>
          <Space vertical align='start' style={{ width: '100%' }}>
            <Text>{t('重复模型处理')}</Text>
            <Text size='small' type='tertiary'>
              {t('左侧是当前已有配置，右侧是本次新增配置，请为每个重复模型选择保留哪一侧。')}
            </Text>
            <Text size='small' type='tertiary'>
              {t('第 {{current}} / {{total}} 条', {
                current: pendingConflictIndex + 1,
                total: pendingMerge.conflicts.length,
              })}
            </Text>
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                width: '100%',
              }}
            >
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#b45309',
                  fontSize: 12,
                }}
              >
                {t('橙色：当前配置差异')}
              </div>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#1d4ed8',
                  fontSize: 12,
                }}
              >
                {t('蓝色：新增配置差异')}
              </div>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#b91c1c',
                  fontSize: 12,
                }}
              >
                {t('红色：该侧缺失字段')}
              </div>
            </div>
            {currentConflict && (
              <div
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background:
                    currentConflict.selectedSide === 'left'
                      ? 'rgba(245, 158, 11, 0.12)'
                      : currentConflict.selectedSide === 'right'
                      ? 'rgba(59, 130, 246, 0.12)'
                      : 'var(--semi-color-fill-0)',
                  color:
                    currentConflict.selectedSide === 'left'
                      ? '#b45309'
                      : currentConflict.selectedSide === 'right'
                      ? '#1d4ed8'
                      : 'var(--semi-color-text-1)',
                }}
              >
                {currentConflict.selectedSide === 'left'
                  ? t('当前选择：保留左侧配置')
                  : currentConflict.selectedSide === 'right'
                  ? t('当前选择：保留右侧配置')
                  : t('当前未选择，请先选择保留左侧还是右侧')}
              </div>
            )}
            {currentConflict && (
              <div style={{ width: '100%' }}>
                <Card style={{ width: '100%' }}>
                  <Space vertical align='start' style={{ width: '100%' }}>
                    <Text strong>{currentConflict.name}</Text>
                    <div style={{ display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <Text type='tertiary'>{t('左侧：当前配置')}</Text>
                        <div
                          style={{
                            marginTop: 8,
                            padding: 12,
                            borderRadius: 8,
                            background: 'var(--semi-color-fill-0)',
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'monospace',
                            fontSize: 13,
                          }}
                        >
                          {renderComparisonValue({
                            currentValue: currentConflict.leftValue,
                            otherValue: currentConflict.rightValue,
                            diffPaths: currentConflictDiffPaths,
                            side: 'left',
                          })}
                        </div>
                        <Button
                          theme={currentConflict.selectedSide === 'left' ? 'solid' : 'outline'}
                          type='primary'
                          onClick={() => handleConflictChoice(currentConflict.name, 'left')}
                        >
                          {t('保留左侧')}
                        </Button>
                      </div>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <Text type='tertiary'>{t('右侧：新增配置')}</Text>
                        <div
                          style={{
                            marginTop: 8,
                            padding: 12,
                            borderRadius: 8,
                            background: 'var(--semi-color-fill-0)',
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'monospace',
                            fontSize: 13,
                          }}
                        >
                          {renderComparisonValue({
                            currentValue: currentConflict.rightValue,
                            otherValue: currentConflict.leftValue,
                            diffPaths: currentConflictDiffPaths,
                            side: 'right',
                          })}
                        </div>
                        <Button
                          theme={currentConflict.selectedSide === 'right' ? 'solid' : 'outline'}
                          type='primary'
                          onClick={() => handleConflictChoice(currentConflict.name, 'right')}
                        >
                          {t('保留右侧')}
                        </Button>
                      </div>
                    </div>
                  </Space>
                </Card>
              </div>
            )}
            <Space>
              <Button
                disabled={pendingConflictIndex <= 0}
                onClick={() => setPendingConflictIndex((value) => Math.max(0, value - 1))}
              >
                {t('上一条')}
              </Button>
              <Button
                disabled={
                  (!isLastConflict && pendingConflictIndex >= pendingMerge.conflicts.length - 1) ||
                  (isLastConflict && hasUnresolvedConflicts)
                }
                onClick={() => {
                  if (isLastConflict) {
                    handleApplyConflictChoices();
                    return;
                  }
                  setPendingConflictIndex((value) =>
                    Math.min(pendingMerge.conflicts.length - 1, value + 1),
                  );
                }}
              >
                {isLastConflict ? t('应用并完成') : t('下一条')}
              </Button>
              <Button onClick={handleCancelConflictChoices}>{t('取消')}</Button>
            </Space>
            {isLastConflict && hasUnresolvedConflicts && (
              <Text size='small' type='tertiary'>
                {t('请先完成所有冲突选择')}
              </Text>
            )}
          </Space>
        </Card>
      )}

      <Card style={{ width: '100%' }} bodyStyle={{ padding: 0 }}>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 480,
            padding: 16,
            fontFamily: 'monospace',
            fontSize: 13,
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            background: 'var(--semi-color-fill-0)',
            color: 'var(--semi-color-text-0)',
            lineHeight: 1.6,
          }}
        />
      </Card>

      <Modal
        title={t('添加模型')}
        visible={showAppendModal}
        onCancel={() => setShowAppendModal(false)}
        onOk={handleAppendModels}
        okText={t('添加模型')}
        cancelText={t('取消')}
        centered
        width={760}
      >
        <Space vertical align='start' style={{ width: '100%' }}>
          <Text size='small' type='tertiary'>
            {t('默认已带最外层大括号，你只需要输入里面的模型内容；如果和现有模型重名，会进入逐条对比选择。')}
          </Text>
          <div style={{ width: '100%' }}>
            <div
              style={{
                padding: '0 4px 8px',
                fontFamily: 'monospace',
                color: 'var(--semi-color-text-2)',
              }}
            >
              {'{'}
            </div>
            <textarea
              value={appendJsonText}
              onChange={(e) => setAppendJsonText(e.target.value)}
              spellCheck={false}
              placeholder={t('例如："claude-haiku-4-5-20251001": {"prompt_price": 1, "completion_price": 5, "cache_read_price": 0.1, "cache_write_price": 1.25, "image_price": 0}')}
              style={{
                width: '100%',
                minHeight: 220,
                padding: 16,
                fontFamily: 'monospace',
                fontSize: 13,
                border: '1px solid var(--semi-color-border)',
                borderRadius: 8,
                outline: 'none',
                resize: 'vertical',
                background: 'var(--semi-color-bg-0)',
                color: 'var(--semi-color-text-0)',
                lineHeight: 1.6,
              }}
            />
            <div
              style={{
                padding: '8px 4px 0',
                fontFamily: 'monospace',
                color: 'var(--semi-color-text-2)',
              }}
            >
              {'}'}
            </div>
          </div>
        </Space>
      </Modal>
    </Space>
  );
}
