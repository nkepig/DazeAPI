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

import React, { useEffect, useState, useRef } from 'react';
import { Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function GeneralSettings(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    RetryTimes: '',
    SelfUseModeEnabled: false,
    'general_setting.recharge_redirect_url': '',
    'global.pass_through_request_enabled': false,
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      const value =
        typeof inputs[item.key] === 'boolean'
          ? String(inputs[item.key])
          : inputs[item.key];
      return API.put('/api/option/', { key: item.key, value });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  }

  const formFieldKeys = [
    'RetryTimes',
    'SelfUseModeEnabled',
    'general_setting.recharge_redirect_url',
    'global.pass_through_request_enabled',
    'SMTPServer',
    'SMTPPort',
    'SMTPAccount',
    'SMTPFrom',
    'SMTPToken',
    'SMTPSSLEnabled',
  ];

  useEffect(() => {
    const currentInputs = {};
    for (const key of formFieldKeys) {
      if (Object.prototype.hasOwnProperty.call(props.options, key)) {
        currentInputs[key] = props.options[key];
      } else {
        currentInputs[key] =
          key === 'SelfUseModeEnabled' || 
          key === 'global.pass_through_request_enabled' ||
          key === 'SMTPSSLEnabled'
            ? false
            : '';
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current.setValues(currentInputs);
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('通用设置')}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field={'RetryTimes'}
                label={t('失败重试次数')}
                initValue={''}
                placeholder={t('失败重试次数')}
                onChange={handleFieldChange('RetryTimes')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field={'SelfUseModeEnabled'}
                label={t('自用模式')}
                extraText={t('开启后不限制：必须设置模型倍率')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange('SelfUseModeEnabled')}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field={'global.pass_through_request_enabled'}
                label={t('全局透传')}
                extraText={t('开启后，所有请求将直接透传给上游渠道，NewAPI 内置功能将失效')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange('global.pass_through_request_enabled')}
              />
            </Col>
            <Col xs={24} sm={24} md={16} lg={16} xl={16}>
              <Form.Input
                field={'general_setting.recharge_redirect_url'}
                label={t('控制台充值跳转地址')}
                initValue={''}
                placeholder={t('例如 https://example.com/topup 或 /console/topup，留空则使用运营设置中的充值链接')}
                onChange={handleFieldChange(
                  'general_setting.recharge_redirect_url',
                )}
                showClear
              />
            </Col>
          </Row>
          <Row>
            <Button size='default' onClick={onSubmit}>
              {t('保存通用设置')}
            </Button>
          </Row>
        </Form.Section>

        <Form.Section text={t('SMTP 设置')}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field={'SMTPServer'}
                label={t('SMTP 服务器地址')}
                placeholder={t('例如：smtp.gmail.com')}
                onChange={handleFieldChange('SMTPServer')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field={'SMTPPort'}
                label={t('SMTP 端口')}
                placeholder={t('例如：587')}
                onChange={handleFieldChange('SMTPPort')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field={'SMTPAccount'}
                label={t('SMTP 账户')}
                placeholder={t('例如：your-email@gmail.com')}
                onChange={handleFieldChange('SMTPAccount')}
                showClear
              />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field={'SMTPFrom'}
                label={t('SMTP 发送者邮箱')}
                placeholder={t('例如：your-email@gmail.com')}
                onChange={handleFieldChange('SMTPFrom')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Input
                field={'SMTPToken'}
                label={t('SMTP 访问凭证')}
                type='password'
                placeholder={t('敏感信息不会发送到前端显示')}
                onChange={handleFieldChange('SMTPToken')}
                showClear
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Switch
                field={'SMTPSSLEnabled'}
                label={t('启用 SMTP SSL')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange('SMTPSSLEnabled')}
              />
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Button size='default' onClick={onSubmit}>
              {t('保存 SMTP 设置')}
            </Button>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}
