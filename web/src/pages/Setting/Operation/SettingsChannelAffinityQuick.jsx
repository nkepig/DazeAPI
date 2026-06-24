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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Empty,
  Form,
  Popconfirm,
  Row,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
  toBoolean,
  verifyJSON,
} from '../../../helpers';

const KEY_ENABLED = 'channel_affinity_setting.enabled';
const KEY_RULES = 'channel_affinity_setting.rules';

// 解析后端返回的 rules JSON 字符串。容错：任何异常都返回空数组。
function parseRules(jsonString) {
  try {
    const parsed = JSON.parse(jsonString || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((rule, index) => ({
      ...(rule || {}),
      name: (rule?.name || '').trim() || `rule-${index + 1}`,
      skip_retry_on_failure: !!rule?.skip_retry_on_failure,
    }));
  } catch (e) {
    return [];
  }
}

// 紧凑序列化（保存时用），剔除内部 UI 用的 id 字段。
function serializeRules(rules) {
  const payload = (rules || []).map(({ ...rest }) => {
    delete rest.id;
    return rest;
  });
  return JSON.stringify(payload);
}

export default function SettingsChannelAffinityQuick(props) {
  const { t } = useTranslation();
  const { Text } = Typography;

  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState([]); // 当前编辑中的规则数组
  const [inputs, setInputs] = useState({
    [KEY_ENABLED]: false,
    [KEY_RULES]: '[]',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  // 统计：有多少条规则启用了"失败不重试"。用于顶部摘要和按钮文案。
  const skipRetryCount = useMemo(
    () => rules.filter((r) => r.skip_retry_on_failure).length,
    [rules],
  );

  // 同步外部 options 到内部 state。注意：enabled 是字符串 "true"/"false"，
  // 需要走 toBoolean；rules 是 JSON 字符串直接保留。
  useEffect(() => {
    const currentInputs = { ...inputs };
    for (const key in props.options) {
      if (![KEY_ENABLED, KEY_RULES].includes(key)) continue;
      if (key === KEY_ENABLED) {
        currentInputs[key] = toBoolean(props.options[key]);
      } else {
        currentInputs[key] = props.options[key] || '[]';
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    if (refForm.current) refForm.current.setValues(currentInputs);
    setRules(parseRules(currentInputs[KEY_RULES]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.options]);

  function updateRulesState(nextRules) {
    setRules(nextRules);
    const jsonString = serializeRules(nextRules);
    setInputs((prev) => ({ ...prev, [KEY_RULES]: jsonString }));
    if (refForm.current) {
      refForm.current.setValue(KEY_RULES, jsonString);
    }
  }

  function toggleRuleSkipRetry(name, value) {
    const next = rules.map((r) =>
      r.name === name ? { ...r, skip_retry_on_failure: value } : r,
    );
    updateRulesState(next);
  }

  function allowRetryForAllRules() {
    if (skipRetryCount === 0) {
      showWarning(t('没有规则启用"失败后不重试"，无需操作'));
      return;
    }
    updateRulesState(rules.map((r) => ({ ...r, skip_retry_on_failure: false })));
    showSuccess(
      t('已为全部规则关闭"失败后不重试"，请点击下方"保存"以生效'),
    );
  }

  async function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));

    if (!verifyJSON(inputs[KEY_RULES] || '[]')) {
      return showError(t('规则 JSON 格式不正确'));
    }
    let compactRules;
    try {
      compactRules = JSON.stringify(JSON.parse(inputs[KEY_RULES] || '[]'));
    } catch (e) {
      return showError(t('规则 JSON 格式不正确'));
    }

    const requestQueue = updateArray.map((item) => {
      let value;
      if (item.key === KEY_RULES) {
        value = compactRules;
      } else if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = String(inputs[item.key] ?? '');
      }
      return API.put('/api/option/', { key: item.key, value });
    });

    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length > 1 && res.includes(undefined)) {
          return showError(t('部分保存失败，请重试'));
        }
        if (requestQueue.length === 1 && res.includes(undefined)) return;
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  }

  const columns = [
    {
      title: t('规则名称'),
      dataIndex: 'name',
      render: (text, record) => (
        <Text strong>{text || '-'}</Text>
      ),
    },
    {
      title: t('命中条件（只读概览）'),
      render: (_, record) => {
        const tags = [];
        const models = (record.model_regex || []).slice(0, 3);
        if (models.length > 0) {
          tags.push(
            <Tag key="model" color="blue" style={{ marginRight: 4 }}>
              {t('模型')}: {models.join(' / ')}
              {(record.model_regex || []).length > 3
                ? ` +${(record.model_regex || []).length - 3}`
                : ''}
            </Tag>,
          );
        }
        const paths = (record.path_regex || []).slice(0, 2);
        if (paths.length > 0) {
          tags.push(
            <Tag key="path" color="cyan" style={{ marginRight: 4 }}>
              {t('路径')}: {paths.join(' / ')}
              {(record.path_regex || []).length > 2
                ? ` +${(record.path_regex || []).length - 2}`
                : ''}
            </Tag>,
          );
        }
        if (tags.length === 0) return <Text type='tertiary'>-</Text>;
        return tags;
      },
    },
    {
      title: t('失败后是否重试'),
      dataIndex: 'skip_retry_on_failure',
      width: 220,
      render: (value, record) => {
        const skip = !!value;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={skip}
              onChange={(v) => toggleRuleSkipRetry(record.name, v)}
              checkedText={t('不重试')}
              uncheckedText={t('允许重试')}
              size='small'
            />
            <Text
              type={skip ? 'danger' : 'success'}
              size='small'
              style={{ whiteSpace: 'nowrap' }}
            >
              {skip
                ? t('忽略全局重试状态码')
                : t('按全局重试状态码处理')}
            </Text>
          </div>
        );
      },
    },
  ];

  const banner = (
    <Banner
      fullMode={false}
      type={skipRetryCount > 0 ? 'warning' : 'info'}
      description={
        <div>
          <Text>
            {t(
              '渠道亲和性会让同一会话/客户端粘到上次成功的渠道。某些规则（如 Codex CLI、Claude CLI 透传）默认开启了"失败后不重试"，会忽略"监控设置 → 自动重试状态码"和"失败重试次数"。',
            )}
          </Text>
          <br />
          <Text strong>
            {t('当前状态：')}
          </Text>
          <Text type={skipRetryCount > 0 ? 'danger' : 'success'}>
            {skipRetryCount > 0
              ? t('{{count}} 条规则启用"失败后不重试"，重试状态码对它们无效', {
                  count: skipRetryCount,
                })
              : t('所有规则都允许按全局重试状态码重试')}
          </Text>
        </div>
      }
    />
  );

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('渠道亲和性（快速重试控制）')}>
          {banner}
          <Row style={{ marginTop: 12, marginBottom: 12 }}>
            <Form.Switch
              field={KEY_ENABLED}
              label={t('启用渠道亲和性')}
              checkedText='|'
              uncheckedText='O'
              onChange={(value) =>
                setInputs({ ...inputs, [KEY_ENABLED]: value })
              }
            />
            <Text type='tertiary' size='small' style={{ marginLeft: 12 }}>
              {t('关闭后所有规则都不生效，所有请求按全局设置选路与重试。')}
            </Text>
          </Row>

          {rules.length === 0 ? (
            <Empty
              title={t('暂无亲和规则')}
              description={t(
                '若需要让 Codex CLI / Claude CLI 透传特定 Header 并粘同一渠道，请前往「模型设置」页的「渠道亲和性」高级配置添加规则。',
              )}
            />
          ) : (
            <>
              <Row style={{ marginBottom: 12 }}>
                <Popconfirm
                  title={t('一键关闭所有规则的"失败后不重试"')}
                  content={t(
                    '将让所有规则失败时都按"自动重试状态码"配置重试。',
                  )}
                  onConfirm={allowRetryForAllRules}
                >
                  <Button type='primary' theme='solid' disabled={skipRetryCount === 0}>
                    {t('一键全部允许按状态码重试')}
                    {skipRetryCount > 0
                      ? ` (${skipRetryCount} ${t('条待关闭')})`
                      : ''}
                  </Button>
                </Popconfirm>
                <Text type='tertiary' size='small' style={{ marginLeft: 12 }}>
                  {t(
                    '只列出与重试相关的字段；如需编辑模型/路径正则、Key 来源、参数覆盖模板等高级字段，请前往「模型设置」页。',
                  )}
                </Text>
              </Row>
              <Table
                columns={columns}
                dataSource={rules.map((r, idx) => ({ ...r, id: idx }))}
                rowKey='id'
                pagination={false}
                size='small'
              />
            </>
          )}

          <Row style={{ marginTop: 12 }}>
            <Button size='default' theme='solid' onClick={onSubmit}>
              {t('保存')}
            </Button>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}