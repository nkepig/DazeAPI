import React, { useEffect, useState, useRef } from 'react';
import { Button, Form, Row, Col, Typography, Spin } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const DEFAULT_GATEWAY = 'https://openapi.alipay.com/gateway.do';

export default function SettingsPaymentGatewayAlipay(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    alipay_app_id: '',
    alipay_private_key: '',
    alipay_public_key: '',
    alipay_gateway: DEFAULT_GATEWAY,
  });
  const [originAppGateway, setOriginAppGateway] = useState({ app: '', gateway: '' });
  const [keySaved, setKeySaved] = useState({ private: false, public: false });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (!props.options || typeof props.options !== 'object') return;
    const opt = props.options;
    const pk = opt['payment_setting.alipay_private_key'] || '';
    const pubk = opt['payment_setting.alipay_public_key'] || '';
    setKeySaved({ private: pk.length > 0, public: pubk.length > 0 });
    const currentInputs = {
      alipay_app_id: opt['payment_setting.alipay_app_id'] || '',
      alipay_private_key: '',
      alipay_public_key: '',
      alipay_gateway: opt['payment_setting.alipay_gateway'] || DEFAULT_GATEWAY,
    };
    setInputs(currentInputs);
    setOriginAppGateway({
      app: currentInputs.alipay_app_id,
      gateway: currentInputs.alipay_gateway,
    });
    const id = requestAnimationFrame(() => {
      formApiRef.current?.setValues(currentInputs);
    });
    return () => cancelAnimationFrame(id);
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitAlipay = async () => {
    setLoading(true);
    try {
      const options = [];
      if (inputs.alipay_app_id !== (originAppGateway.app || '')) {
        options.push({ key: 'payment_setting.alipay_app_id', value: inputs.alipay_app_id });
      }
      if (inputs.alipay_gateway !== (originAppGateway.gateway || '')) {
        options.push({ key: 'payment_setting.alipay_gateway', value: inputs.alipay_gateway });
      }

      const priv = (inputs.alipay_private_key || '').trim();
      const pub = (inputs.alipay_public_key || '').trim();

      if (!keySaved.private && !priv) {
        showError(t('请填写应用私钥'));
        setLoading(false);
        return;
      }
      if (!keySaved.public && !pub) {
        showError(t('请填写支付宝公钥'));
        setLoading(false);
        return;
      }
      if (priv) {
        options.push({ key: 'payment_setting.alipay_private_key', value: priv });
      }
      if (pub) {
        options.push({ key: 'payment_setting.alipay_public_key', value: pub });
      }

      if (options.length === 0) {
        showSuccess(t('没有需要更新的配置'));
        setLoading(false);
        return;
      }

      const requestQueue = options.map((opt) =>
        API.put('/api/option/', { key: opt.key, value: opt.value }),
      );

      const results = await Promise.all(requestQueue);
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data.message));
      } else {
        showSuccess(t('更新成功'));
        if (priv) setKeySaved((k) => ({ ...k, private: true }));
        if (pub) setKeySaved((k) => ({ ...k, public: true }));
        setOriginAppGateway({
          app: inputs.alipay_app_id,
          gateway: inputs.alipay_gateway,
        });
        props.refresh && props.refresh();
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
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={t('支付宝当面付设置')}>
          <Text style={{ marginBottom: 12, display: 'block' }}>
            {t('配置以下四项即可启用支付宝扫码充值（当面付），回调地址由服务端自动拼接。')}
          </Text>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='alipay_app_id'
                label={t('ALIPAY_APP_ID')}
                placeholder='2021000000000000'
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='alipay_gateway'
                label={t('ALIPAY_GATEWAY')}
                placeholder={DEFAULT_GATEWAY}
              />
            </Col>
          </Row>
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='alipay_private_key'
                label={t('ALIPAY_PRIVATE_KEY')}
                placeholder={
                  keySaved.private
                    ? t('密钥已保存，输入新内容可替换，留空不修改')
                    : t('RSA2 应用私钥，支持 PEM 或裸密钥')
                }
                type='password'
                autosize
                style={{ fontFamily: 'monospace' }}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='alipay_public_key'
                label={t('ALIPAY_PUBLIC_KEY')}
                placeholder={
                  keySaved.public
                    ? t('密钥已保存，输入新内容可替换，留空不修改')
                    : t('支付宝公钥，支持 PEM 或裸密钥')
                }
                autosize
                style={{ fontFamily: 'monospace' }}
              />
            </Col>
          </Row>
          <Button onClick={submitAlipay} style={{ marginTop: 16 }} theme='solid' type='primary'>
            {t('保存支付宝设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
