import React, { useEffect, useRef, useState } from 'react';
import { Button, Col, Form, Row, Spin, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function SettingsPaymentGatewayEpay(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    epay_enabled: false,
    epay_api_url: '',
    epay_pid: '',
    epay_key: '',
    epay_pay_types: 'alipay,wxpay',
  });
  const [keySaved, setKeySaved] = useState(false);
  const formApiRef = useRef(null);

  useEffect(() => {
    if (!props.options || typeof props.options !== 'object') return;
    const currentInputs = {
      epay_enabled:
        props.options['payment_setting.epay_enabled'] === 'true' ||
        props.options['payment_setting.epay_enabled'] === true,
      epay_api_url: props.options['payment_setting.epay_api_url'] || '',
      epay_pid: props.options['payment_setting.epay_pid'] || '',
      epay_key: '',
      epay_pay_types:
        props.options['payment_setting.epay_pay_types'] || 'alipay,wxpay',
    };
    setKeySaved(Boolean(props.options['payment_setting.epay_key']));
    setInputs(currentInputs);
    const id = requestAnimationFrame(() => {
      formApiRef.current?.setValues(currentInputs);
    });
    return () => cancelAnimationFrame(id);
  }, [props.options]);

  const submitEpay = async () => {
    setLoading(true);
    try {
      const options = [
        { key: 'payment_setting.epay_enabled', value: inputs.epay_enabled ? 'true' : 'false' },
        { key: 'payment_setting.epay_api_url', value: inputs.epay_api_url || '' },
        { key: 'payment_setting.epay_pid', value: inputs.epay_pid || '' },
        { key: 'payment_setting.epay_pay_types', value: inputs.epay_pay_types || '' },
      ];
      const key = (inputs.epay_key || '').trim();
      if (key) {
        options.push({ key: 'payment_setting.epay_key', value: key });
      } else if (inputs.epay_enabled && !keySaved) {
        showError(t('请填写易支付商户密钥'));
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        options.map((opt) => API.put('/api/option/', opt)),
      );
      const errors = results.filter((res) => !res.data.success);
      if (errors.length > 0) {
        errors.forEach((res) => showError(res.data.message));
      } else {
        showSuccess(t('更新成功'));
        if (key) setKeySaved(true);
        props.refresh?.();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={setInputs}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={t('易支付设置')}>
          <Text style={{ marginBottom: 12, display: 'block' }}>
            {t('配置虎皮椒（xunhupay）易支付网关后，用户可通过易支付跳转充值。')}
          </Text>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch field='epay_enabled' label={t('启用易支付')} />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='epay_api_url'
                label={t('易支付网关地址')}
                placeholder='https://api.dpweixin.com/payment/do.html'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input field='epay_pid' label={t('易支付商户 ID (AppID)')} />
            </Col>
          </Row>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }} style={{ marginTop: 16 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='epay_key'
                label={t('易支付商户密钥 (AppSecret)')}
                type='password'
                placeholder={keySaved ? t('密钥已保存，输入新内容可替换，留空不修改') : ''}
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Input
                field='epay_pay_types'
                label={t('前端支付方式按钮 (仅展示)')}
                placeholder='alipay,wxpay'
              />
            </Col>
          </Row>
          <Button onClick={submitEpay} style={{ marginTop: 16 }} theme='solid' type='primary'>
            {t('保存易支付设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
