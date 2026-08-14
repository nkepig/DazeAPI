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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, Select, TextArea } from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';

const VISUAL_ACTIONS = new Set(['set', 'copy', 'delete', 'replace']);
const MODE_TO_COND = {
  full: 'eq',
  contains: 'contains',
  prefix: 'prefix',
  suffix: 'suffix',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
};

let ruleSeq = 0;
const nextRuleId = () => `rule_${Date.now()}_${ruleSeq++}`;

function stripBodyPrefix(path) {
  const p = String(path || '').trim();
  if (/^body\./i.test(p)) return p.slice(5);
  if (/^body$/i.test(p)) return '';
  return p;
}

function formatBodyPath(path) {
  const p = String(path || '').trim();
  if (!p) return '';
  if (/^body$/i.test(p) || /^body\./i.test(p)) return p;
  return `body.${p}`;
}

function parseScalar(raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return '';
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  if (
    (s.startsWith('{') && s.endsWith('}')) ||
    (s.startsWith('[') && s.endsWith(']'))
  ) {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function formatScalar(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function emptyRule() {
  return {
    id: nextRuleId(),
    condOp: 'eq',
    condPath: '',
    condValue: '',
    action: 'set',
    targetPath: '',
    setValue: '',
    fromPath: '',
    replaceFrom: '',
    replaceTo: '',
  };
}

function conditionToRuleFields(conditions) {
  if (!Array.isArray(conditions) || conditions.length !== 1) {
    return { ok: conditions == null || conditions.length === 0, always: true };
  }
  const cond = conditions[0] || {};
  const mode = String(cond.mode || 'full').toLowerCase();
  let condOp = MODE_TO_COND[mode];
  if (!condOp) return { ok: false };
  if (cond.invert) {
    if (condOp === 'eq') condOp = 'neq';
    else return { ok: false };
  }
  return {
    ok: true,
    always: false,
    condOp,
    condPath: formatBodyPath(cond.path),
    condValue: formatScalar(cond.value),
  };
}

function operationToRule(op) {
  if (!op || !VISUAL_ACTIONS.has(op.mode)) return null;
  const cond = conditionToRuleFields(op.conditions);
  if (!cond.ok) return null;
  const rule = {
    ...emptyRule(),
    condOp: cond.always ? 'always' : cond.condOp,
    condPath: cond.condPath || '',
    condValue: cond.condValue || '',
    action: op.mode,
  };
  if (op.mode === 'set') {
    rule.targetPath = formatBodyPath(op.path);
    rule.setValue = formatScalar(op.value);
  } else if (op.mode === 'copy') {
    rule.fromPath = formatBodyPath(op.from);
    rule.targetPath = formatBodyPath(op.to);
  } else if (op.mode === 'delete') {
    rule.targetPath = formatBodyPath(op.path);
  } else if (op.mode === 'replace') {
    rule.targetPath = formatBodyPath(op.path);
    rule.replaceFrom = String(op.from ?? '');
    rule.replaceTo = String(op.to ?? '');
  }
  return rule;
}

function parseToRules(raw) {
  if (raw == null) return { rules: [], visual: true, text: '' };
  const text = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw, null, 2);
  if (!text || text === '{}') return { rules: [], visual: true, text: '' };

  const fail = (pretty) => ({
    rules: [],
    visual: false,
    text: pretty || text,
  });

  if (!text.startsWith('{') && !text.startsWith('[')) {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    const rules = [];
    for (const line of lines) {
      const eq = line.indexOf('=');
      if (eq <= 0) return fail(text);
      const to = line.slice(0, eq).trim();
      const from = line.slice(eq + 1).trim();
      if (!to || !from) return fail(text);
      rules.push({
        ...emptyRule(),
        condOp: 'always',
        action: 'copy',
        targetPath: formatBodyPath(to),
        fromPath: formatBodyPath(from),
      });
    }
    return { rules, visual: true, text };
  }

  let parsed;
  try {
    parsed = typeof raw === 'object' ? raw : JSON.parse(text);
  } catch {
    return fail(text);
  }

  if (Array.isArray(parsed)) {
    const rules = parsed.map(operationToRule);
    if (rules.some((rule) => !rule)) return fail(JSON.stringify(parsed, null, 2));
    return { rules, visual: true, text: JSON.stringify({ operations: parsed }, null, 2) };
  }

  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.operations)) {
    const extraKeys = Object.keys(parsed).filter((key) => key !== 'operations');
    if (extraKeys.length > 0) return fail(JSON.stringify(parsed, null, 2));
    const rules = parsed.operations.map(operationToRule);
    if (rules.some((rule) => !rule)) {
      return fail(JSON.stringify(parsed, null, 2));
    }
    return { rules, visual: true, text: JSON.stringify(parsed, null, 2) };
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const rules = Object.entries(parsed).map(([key, value]) => ({
      ...emptyRule(),
      condOp: 'always',
      action: 'set',
      targetPath: formatBodyPath(key),
      setValue: formatScalar(value),
    }));
    return { rules, visual: true, text: JSON.stringify(parsed, null, 2) };
  }

  return fail(text);
}

function ruleToOperation(rule) {
  const target = stripBodyPrefix(rule.targetPath || rule.condPath);
  const op = { mode: rule.action };
  if (rule.action === 'set') {
    if (!target) return null;
    op.path = target;
    op.value = parseScalar(rule.setValue);
  } else if (rule.action === 'copy') {
    const from = stripBodyPrefix(rule.fromPath);
    if (!from || !target) return null;
    op.from = from;
    op.to = target;
  } else if (rule.action === 'delete') {
    if (!target) return null;
    op.path = target;
  } else if (rule.action === 'replace') {
    if (!target || !rule.replaceFrom) return null;
    op.path = target;
    op.from = rule.replaceFrom;
    op.to = rule.replaceTo ?? '';
  } else {
    return null;
  }

  if (rule.condOp && rule.condOp !== 'always') {
    const condPath = stripBodyPrefix(rule.condPath);
    if (!condPath) return null;
    const condition = {
      path: condPath,
      mode: rule.condOp === 'neq' ? 'full' : rule.condOp === 'eq' ? 'full' : rule.condOp,
      value: parseScalar(rule.condValue),
    };
    if (rule.condOp === 'neq') condition.invert = true;
    op.conditions = [condition];
    op.logic = 'AND';
  }
  return op;
}

function rulesToJson(rules) {
  const operations = (rules || [])
    .map(ruleToOperation)
    .filter(Boolean);
  if (operations.length === 0) return '';
  return JSON.stringify({ operations }, null, 2);
}

const ParamOverrideEditor = ({
  field = 'param_override',
  value = '',
  onChange,
  formApi,
  resetKey,
}) => {
  const { t } = useTranslation();
  const lastEmittedRef = useRef(typeof value === 'string' ? value : '');
  const [mode, setMode] = useState(() =>
    parseToRules(value).visual ? 'visual' : 'json',
  );
  const [rules, setRules] = useState(() => parseToRules(value).rules);
  const [jsonText, setJsonText] = useState(() => parseToRules(value).text);
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    const incoming = typeof value === 'string' ? value : '';
    if (incoming === (lastEmittedRef.current || '')) {
      return;
    }
    lastEmittedRef.current = incoming;
    const next = parseToRules(value);
    setRules(next.rules);
    setJsonText(next.text);
    setJsonError('');
    setMode(next.visual ? 'visual' : 'json');
  }, [value, resetKey]);

  const emit = useCallback(
    (nextValue) => {
      const next = nextValue || '';
      lastEmittedRef.current = next;
      onChange?.(next);
      formApi?.setValue?.(field, next);
    },
    [field, formApi, onChange],
  );

  const updateRules = (nextRules) => {
    setRules(nextRules);
    emit(rulesToJson(nextRules));
  };

  const patchRule = (id, patch) => {
    updateRules(
      rules.map((rule) => {
        if (rule.id !== id) return rule;
        const next = { ...rule, ...patch };
        if (
          Object.prototype.hasOwnProperty.call(patch, 'condPath') &&
          (!rule.targetPath || rule.targetPath === rule.condPath)
        ) {
          next.targetPath = patch.condPath;
        }
        return next;
      }),
    );
  };

  const handleJsonChange = (text) => {
    setJsonText(text);
    const trimmed = (text || '').trim();
    if (!trimmed) {
      setJsonError('');
      emit('');
      return;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        setJsonError('');
        emit(trimmed);
      } catch (error) {
        setJsonError(error.message);
      }
      return;
    }
    setJsonError('');
    emit(trimmed);
  };

  const switchMode = (nextMode) => {
    if (nextMode === 'json') {
      setJsonText(rulesToJson(rules) || jsonText);
      setMode('json');
      return;
    }
    const next = parseToRules(jsonText || value);
    if (!next.visual) {
      setJsonError(t('当前规则含可视化不支持的操作，请用 JSON 编辑'));
      return;
    }
    setJsonError('');
    setRules(next.rules);
    setMode('visual');
    emit(rulesToJson(next.rules));
  };

  const condOpOptions = [
    { value: 'eq', label: t('等于') },
    { value: 'neq', label: t('不等于') },
    { value: 'contains', label: t('包含') },
    { value: 'prefix', label: t('前缀是') },
    { value: 'suffix', label: t('后缀是') },
    { value: 'gt', label: t('大于') },
    { value: 'gte', label: t('大于等于') },
    { value: 'lt', label: t('小于') },
    { value: 'lte', label: t('小于等于') },
    { value: 'always', label: t('始终') },
  ];

  const actionOptions = [
    { value: 'set', label: t('改为') },
    { value: 'copy', label: t('复制自') },
    { value: 'replace', label: t('替换文本') },
    { value: 'delete', label: t('删除字段') },
  ];

  const renderActionFields = (rule) => {
    if (rule.action === 'delete') {
      return (
        <Input
          placeholder={t('目标字段，如 body.temperature')}
          value={rule.targetPath}
          onChange={(v) => patchRule(rule.id, { targetPath: v })}
          style={{ flex: '1 1 180px' }}
        />
      );
    }
    if (rule.action === 'copy') {
      return (
        <>
          <Input
            placeholder={t('目标字段，如 body.temperature')}
            value={rule.targetPath}
            onChange={(v) => patchRule(rule.id, { targetPath: v })}
            style={{ flex: '1 1 140px' }}
          />
          <Input
            placeholder={t('源字段，如 body.top_p')}
            value={rule.fromPath}
            onChange={(v) => patchRule(rule.id, { fromPath: v })}
            style={{ flex: '1 1 140px' }}
          />
        </>
      );
    }
    if (rule.action === 'replace') {
      return (
        <>
          <Input
            placeholder={t('目标字段')}
            value={rule.targetPath}
            onChange={(v) => patchRule(rule.id, { targetPath: v })}
            style={{ flex: '1 1 120px' }}
          />
          <Input
            placeholder={t('原文本')}
            value={rule.replaceFrom}
            onChange={(v) => patchRule(rule.id, { replaceFrom: v })}
            style={{ flex: '1 1 100px' }}
          />
          <Input
            placeholder={t('新文本')}
            value={rule.replaceTo}
            onChange={(v) => patchRule(rule.id, { replaceTo: v })}
            style={{ flex: '1 1 100px' }}
          />
        </>
      );
    }
    return (
      <>
        <Input
          placeholder={t('目标字段，如 body.temperature')}
          value={rule.targetPath}
          onChange={(v) => patchRule(rule.id, { targetPath: v })}
          style={{ flex: '1 1 140px' }}
        />
        <Input
          placeholder={t('新值，如 0.2')}
          value={rule.setValue}
          onChange={(v) => patchRule(rule.id, { setValue: v })}
          style={{ flex: '1 1 140px' }}
        />
      </>
    );
  };

  return (
    <Form.Slot label={t('参数重定向')}>
      <div className='param-override-editor'>
        <div className='flex items-center justify-end mb-2'>
          <button
            type='button'
            className='param-override-mode'
            onClick={() => switchMode(mode === 'visual' ? 'json' : 'visual')}
          >
            {mode === 'visual' ? t('JSON') : t('规则视图')}
          </button>
        </div>

        {jsonError ? (
          <p className='compact-hint' style={{ color: '#b42318' }}>
            {jsonError}
          </p>
        ) : null}

        {mode === 'visual' ? (
          <>
            {rules.length === 0 ? (
              <div className='param-rule-empty'>
                {t('还没有规则。例如：如果 body.model 等于 gpt-4，则把 body.temperature 改为 0.2')}
              </div>
            ) : (
              rules.map((rule, index) => (
                <div key={rule.id} className='param-rule-card'>
                  <div className='param-rule-index'>{index + 1}</div>
                  <div className='param-rule-body'>
                    <div className='param-rule-line'>
                      <span className='param-rule-kicker'>{t('如果')}</span>
                      {rule.condOp === 'always' ? (
                        <Select
                          value={rule.condOp}
                          optionList={condOpOptions}
                          onChange={(v) => patchRule(rule.id, { condOp: v })}
                          style={{ width: 108 }}
                        />
                      ) : (
                        <>
                          <Input
                            placeholder={t('请求字段，如 body.model')}
                            value={rule.condPath}
                            onChange={(v) => patchRule(rule.id, { condPath: v })}
                            style={{ flex: '1 1 140px' }}
                          />
                          <Select
                            value={rule.condOp}
                            optionList={condOpOptions}
                            onChange={(v) => patchRule(rule.id, { condOp: v })}
                            style={{ width: 108 }}
                          />
                          <Input
                            placeholder={t('条件值，如 gpt-4')}
                            value={rule.condValue}
                            onChange={(v) => patchRule(rule.id, { condValue: v })}
                            style={{ flex: '1 1 140px' }}
                          />
                        </>
                      )}
                    </div>
                    <div className='param-rule-line'>
                      <span className='param-rule-kicker'>{t('则')}</span>
                      <Select
                        value={rule.action}
                        optionList={actionOptions}
                        onChange={(v) => patchRule(rule.id, { action: v })}
                        style={{ width: 108 }}
                      />
                      {renderActionFields(rule)}
                    </div>
                  </div>
                  <Button
                    type='tertiary'
                    theme='borderless'
                    icon={<IconDelete />}
                    onClick={() =>
                      updateRules(rules.filter((item) => item.id !== rule.id))
                    }
                  />
                </div>
              ))
            )}
            <Button
              icon={<IconPlus />}
              type='tertiary'
              onClick={() => updateRules([...rules, emptyRule()])}
            >
              {t('添加规则')}
            </Button>
          </>
        ) : (
          <TextArea
            value={jsonText}
            onChange={handleJsonChange}
            placeholder={'{\n  "operations": []\n}'}
            autosize={{ minRows: 6, maxRows: 16 }}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        )}

        <Form.Input
          field={field}
          value={value}
          noLabel
          className='param-override-hidden-field'
          style={{ display: 'none' }}
        />
      </div>
    </Form.Slot>
  );
};

export default ParamOverrideEditor;
