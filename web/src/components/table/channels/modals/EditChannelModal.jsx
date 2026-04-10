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

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  verifyJSON,
  isRoot,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { CHANNEL_OPTIONS, MODEL_FETCHABLE_CHANNEL_TYPES } from '../../../../constants';
import {
  SideSheet,
  Space,
  Spin,
  Button,
  Typography,
  Checkbox,
  Banner,
  Modal,
  ImagePreview,
  Card,
  Tag,
  Avatar,
  Form,
  Row,
  Col,
  Highlight,
  Input,
  Tooltip,
  Collapse,
  Dropdown,
} from '@douyinfe/semi-ui';
import {
  getChannelModels,
  copy,
  getChannelIcon,
  getModelCategories,
  selectFilter,
} from '../../../../helpers';
import ModelSelectModal from './ModelSelectModal';
import SingleModelSelectModal from './SingleModelSelectModal';
import OllamaModelModal from './OllamaModelModal';
import JSONEditor from '../../../common/ui/JSONEditor';
import StatusCodeRiskGuardModal from './StatusCodeRiskGuardModal';
import {
  collectInvalidStatusCodeEntries,
  collectNewDisallowedStatusCodeRedirects,
} from './statusCodeRiskGuard';
import {
  IconSave,
  IconClose,
  IconServer,
  IconSetting,
  IconCopy,
  IconGlobe,
  IconBolt,
  IconSearch,
  IconChevronDown,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const MODEL_MAPPING_EXAMPLE = {
  'gpt-3.5-turbo': 'gpt-3.5-turbo-0125',
};

const STATUS_CODE_MAPPING_EXAMPLE = {
  400: '500',
};

const REGION_EXAMPLE = {
  default: 'global',
  'gemini-1.5-pro-002': 'europe-west2',
  'gemini-1.5-flash-002': 'europe-west2',
  'claude-3-5-sonnet-20240620': 'europe-west1',
};

const DEPRECATED_DOUBAO_CODING_PLAN_BASE_URL = 'doubao-coding-plan';

// 支持并且已适配通过接口获取模型列表的渠道类型
const MODEL_FETCHABLE_TYPES = new Set([
  1, 4, 14, 34, 17, 26, 27, 24, 47, 25, 20, 23, 31, 40, 42, 48, 43,
]);

function type2secretPrompt(type) {
  // inputs.type === 15 ? '按照如下格式输入：APIKey|SecretKey' : (inputs.type === 18 ? '按照如下格式输入：APPID|APISecret|APIKey' : '请输入渠道对应的鉴权密钥')
  switch (type) {
    case 15:
      return '按照如下格式输入：APIKey|SecretKey';
    case 18:
      return '按照如下格式输入：APPID|APISecret|APIKey';
    case 22:
      return '按照如下格式输入：APIKey-AppId，例如：fastgpt-0sp2gtvfdgyi4k30jwlgwf1i-64f335d84283f05518e9e041';
    case 23:
      return '按照如下格式输入：AppId|SecretId|SecretKey';
    case 33:
      return '按照如下格式输入：Ak|Sk|Region';
    case 45:
      return '请输入渠道对应的鉴权密钥, 豆包语音输入：AppId|AccessToken';
    case 50:
      return '按照如下格式输入: AccessKey|SecretKey, 如果上游是New API，则直接输ApiKey';
    case 51:
      return '按照如下格式输入: AccessKey|SecretAccessKey';
    case 57:
      return '请输入 JSON 格式的 OAuth 凭据（必须包含 access_token 和 account_id）';
    default:
      return '请输入渠道对应的鉴权密钥';
  }
}

const EditChannelModal = (props) => {
  const { t } = useTranslation();
  const channelId = props.editingChannel.id;
  const isEdit = channelId !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const isMobile = useIsMobile();
  const handleCancel = () => {
    props.handleClose();
  };
  const originInputs = {
    name: '',
    type: 1,
    openai_organization: '',
    max_input_tokens: 0,
    base_url: '',
    other: '',
    model_mapping: '',
    param_override: '',
    status_code_mapping: '',
    models: [],
    auto_ban: 1,
    test_model: '',
    groups: ['default'],
    priority: 0,
    weight: 0,
    tag: '',
    settings: '',
    key: '',
    // 企业账户设置
    is_enterprise_account: false,
    // 渠道 setting 字段（ChannelSettings）
    pass_through_body_enabled: false,
    proxy: '',
  };
  const [autoBan, setAutoBan] = useState(true);
  const [inputs, setInputs] = useState(originInputs);
  const [originModelOptions, setOriginModelOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [basicModels, setBasicModels] = useState([]);
  const [fullModels, setFullModels] = useState([]);
  const [modelGroups, setModelGroups] = useState([]);
  const [customModel, setCustomModel] = useState('');
  const [modelSearchValue, setModelSearchValue] = useState('');
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [isModalOpenurl, setIsModalOpenurl] = useState(false);
  const [modelModalVisible, setModelModalVisible] = useState(false);
  const [fetchedModels, setFetchedModels] = useState([]);
  const [modelMappingValueModalVisible, setModelMappingValueModalVisible] =
    useState(false);
  const [modelMappingValueModalModels, setModelMappingValueModalModels] =
    useState([]);
  const [modelMappingValueKey, setModelMappingValueKey] = useState('');
  const [modelMappingValueSelected, setModelMappingValueSelected] =
    useState('');
  const [ollamaModalVisible, setOllamaModalVisible] = useState(false);
  const formApiRef = useRef(null);
  const [channelSearchValue, setChannelSearchValue] = useState('');
  const [isEnterpriseAccount, setIsEnterpriseAccount] = useState(false); // 是否为企业账户
  const [doubaoApiEditUnlocked, setDoubaoApiEditUnlocked] = useState(false); // 豆包渠道自定义 API 地址隐藏入口
  const redirectModelList = useMemo(() => {
    const mapping = inputs.model_mapping;
    if (typeof mapping !== 'string') return [];
    const trimmed = mapping.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return [];
      }
      const values = Object.values(parsed)
        .map((value) => (typeof value === 'string' ? value.trim() : undefined))
        .filter((value) => value);
      return Array.from(new Set(values));
    } catch (error) {
      return [];
    }
  }, [inputs.model_mapping]);
  const modelSearchMatchedCount = useMemo(() => {
    const keyword = modelSearchValue.trim();
    if (!keyword) {
      return modelOptions.length;
    }
    return modelOptions.reduce(
      (count, option) => count + (selectFilter(keyword, option) ? 1 : 0),
      0,
    );
  }, [modelOptions, modelSearchValue]);
  const modelSearchHintText = useMemo(() => {
    const keyword = modelSearchValue.trim();
    if (!keyword || modelSearchMatchedCount !== 0) {
      return '';
    }
    return t('未匹配到模型，按回车键可将「{{name}}」作为自定义模型名添加', {
      name: keyword,
    });
  }, [modelSearchMatchedCount, modelSearchValue, t]);
  const [isIonetChannel, setIsIonetChannel] = useState(false);
  const [ionetMetadata, setIonetMetadata] = useState(null);
  const [codexCredentialRefreshing, setCodexCredentialRefreshing] =
    useState(false);

  useEffect(() => {
    if (!isEdit) {
      setIsIonetChannel(false);
      setIonetMetadata(null);
    }
  }, [isEdit]);

  const handleOpenIonetDeployment = () => {
    if (!ionetMetadata?.deployment_id) {
      return;
    }
    const targetUrl = `/console/deployment?deployment_id=${ionetMetadata.deployment_id}`;
    window.open(targetUrl, '_blank', 'noopener');
  };
  const statusCodeRiskConfirmResolverRef = useRef(null);
  const [statusCodeRiskConfirmVisible, setStatusCodeRiskConfirmVisible] =
    useState(false);
  const [statusCodeRiskDetailItems, setStatusCodeRiskDetailItems] = useState(
    [],
  );

  // 高级设置折叠状态
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const formContainerRef = useRef(null);
  const doubaoApiClickCountRef = useRef(0);
  const initialBaseUrlRef = useRef('');
  const initialModelsRef = useRef([]);
  const initialModelMappingRef = useRef('');
  const initialStatusCodeMappingRef = useRef('');
  const doubaoCodingPlanDeprecationMessage =
    'Doubao Coding Plan 不再允许新增。根据火山方舟文档，Coding 套餐额度仅适用于 AI Coding 产品内调用，不适用于单独 API 调用；在非 AI Coding 产品中使用对应的 Base URL 和 API Key 可能被视为违规，并可能导致订阅停用或账号封禁。';
  const canKeepDeprecatedDoubaoCodingPlan =
    initialBaseUrlRef.current === DEPRECATED_DOUBAO_CODING_PLAN_BASE_URL;
  const doubaoCodingPlanOptionLabel = (
    <Tooltip content={doubaoCodingPlanDeprecationMessage} position='left'>
      <span className='inline-flex items-center gap-2'>
        <span>Doubao Coding Plan</span>
      </span>
    </Tooltip>
  );

  // 2FA状态更新辅助函数
  const updateTwoFAState = (updates) => {
    setTwoFAState((prev) => ({ ...prev, ...updates }));
  };
  const handleApiConfigSecretClick = () => {
    if (inputs.type !== 45) return;
    const next = doubaoApiClickCountRef.current + 1;
    doubaoApiClickCountRef.current = next;
    if (next >= 10) {
      setDoubaoApiEditUnlocked((unlocked) => {
        if (!unlocked) {
          showInfo(t('已解锁豆包自定义 API 地址编辑'));
        }
        return true;
      });
    }
  };

  const handleChannelOtherSettingsChange = (key, value) => {
    if (formApiRef.current) {
      formApiRef.current.setValue(key, value);
    }
    setInputs((prev) => ({ ...prev, [key]: value }));
    let settings = {};
    if (inputs.settings) {
      try {
        settings = JSON.parse(inputs.settings);
      } catch (error) {
        console.error('解析设置失败:', error);
      }
    }
    settings[key] = value;
    handleInputChange('settings', JSON.stringify(settings));
  };

  const showApiConfigCard = true;
  const getInitValues = () => ({ ...originInputs });

  const isIonetLocked = isIonetChannel && isEdit;

  const handleInputChange = (name, value) => {
    if (
      isIonetChannel &&
      isEdit &&
      ['type', 'base_url'].includes(name)
    ) {
      return;
    }
    if (formApiRef.current) {
      formApiRef.current.setValue(name, value);
    }
    if (name === 'models' && Array.isArray(value)) {
      value = Array.from(new Set(value.map((m) => (m || '').trim())));
    }

    if (name === 'base_url' && value.endsWith('/v1')) {
      Modal.confirm({
        title: '警告',
        content:
          '不需要在末尾加/v1，New API会自动处理，添加后可能导致请求失败，是否继续？',
        onOk: () => {
          setInputs((inputs) => ({ ...inputs, [name]: value }));
        },
      });
      return;
    }
    setInputs((inputs) => ({ ...inputs, [name]: value }));
    if (name === 'type') {
      let localModels = [];
      switch (value) {
        case 2:
          localModels = [
            'mj_imagine',
            'mj_variation',
            'mj_reroll',
            'mj_blend',
            'mj_upscale',
            'mj_describe',
            'mj_uploads',
          ];
          break;
        case 5:
          localModels = [
            'swap_face',
            'mj_imagine',
            'mj_video',
            'mj_edits',
            'mj_variation',
            'mj_reroll',
            'mj_blend',
            'mj_upscale',
            'mj_describe',
            'mj_zoom',
            'mj_shorten',
            'mj_modal',
            'mj_inpaint',
            'mj_custom_zoom',
            'mj_high_variation',
            'mj_low_variation',
            'mj_pan',
            'mj_uploads',
          ];
          break;
        case 36:
          localModels = ['suno_music', 'suno_lyrics'];
          break;
        case 45:
          localModels = getChannelModels(value);
          setInputs((prevInputs) => ({
            ...prevInputs,
            base_url: 'https://ark.cn-beijing.volces.com',
          }));
          break;
        default:
          localModels = getChannelModels(value);
          break;
      }
      if (inputs.models.length === 0) {
        setInputs((inputs) => ({ ...inputs, models: localModels }));
      }
      setBasicModels(localModels);

    }
    //setAutoBan
  };

  const formatJsonField = (fieldName) => {
    const rawValue = (inputs?.[fieldName] ?? '').trim();
    if (!rawValue) return;

    try {
      const parsed = JSON.parse(rawValue);
      handleInputChange(fieldName, JSON.stringify(parsed, null, 2));
    } catch (error) {
      showError(`${t('JSON格式错误')}: ${error.message}`);
    }
  };


  const loadChannel = async () => {
    setLoading(true);
    let res = await API.get(`/api/channel/${channelId}`);
    if (res === undefined) {
      return;
    }
    const { success, message, data } = res.data;
    if (success) {
      if (data.models === '') {
        data.models = [];
      } else {
        data.models = data.models.split(',');
      }
      if (data.group === '') {
        data.groups = [];
      } else {
        data.groups = data.group.split(',');
      }
      if (data.model_mapping !== '') {
        data.model_mapping = JSON.stringify(
          JSON.parse(data.model_mapping),
          null,
          2,
        );
      }
      if (data.settings) {
        try {
          const parsedSettings = JSON.parse(data.settings);
          data.azure_responses_version =
            parsedSettings.azure_responses_version || '';
          // 读取企业账户设置
          data.is_enterprise_account =
            parsedSettings.openrouter_enterprise === true;
        } catch (error) {
          console.error('解析其他设置失败:', error);
          data.azure_responses_version = '';
          data.region = '';
          data.is_enterprise_account = false;
        }
      } else {
        data.is_enterprise_account = false;
      }

      // 读取 setting 字段（ChannelSettings）
      if (data.setting) {
        try {
          const parsedSetting = JSON.parse(data.setting);
          data.pass_through_body_enabled =
            parsedSetting.pass_through_body_enabled === true;
          data.proxy = parsedSetting.proxy || '';
        } catch (error) {
          console.error('解析渠道设置失败:', error);
          data.pass_through_body_enabled = false;
          data.proxy = '';
        }
      } else {
        data.pass_through_body_enabled = false;
        data.proxy = '';
      }

      if (
        data.type === 45 &&
        (!data.base_url ||
          (typeof data.base_url === 'string' && data.base_url.trim() === ''))
      ) {
        data.base_url = 'https://ark.cn-beijing.volces.com';
      }

      initialBaseUrlRef.current = data.base_url || '';
      data.key = '';
      setInputs(data);
      if (formApiRef.current) {
        formApiRef.current.setValues(data);
      }
      if (data.auto_ban === 0) {
        setAutoBan(false);
      } else {
        setAutoBan(true);
      }
      // 同步企业账户状态
      setIsEnterpriseAccount(data.is_enterprise_account || false);
      setBasicModels(getChannelModels(data.type));
      initialModelsRef.current = (data.models || [])
        .map((model) => (model || '').trim())
        .filter(Boolean);
      initialModelMappingRef.current = data.model_mapping || '';
      initialStatusCodeMappingRef.current = data.status_code_mapping || '';

      let parsedIonet = null;
      if (data.other_info) {
        try {
          const maybeMeta = JSON.parse(data.other_info);
          if (
            maybeMeta &&
            typeof maybeMeta === 'object' &&
            maybeMeta.source === 'ionet'
          ) {
            parsedIonet = maybeMeta;
          }
        } catch (error) {
          // ignore parse error
        }
      }
      const managedByIonet = !!parsedIonet;
      setIsIonetChannel(managedByIonet);
      setIonetMetadata(parsedIonet);

      // Smart expand: auto-open advanced settings if any advanced field has a value
      const hasAdvancedValues =
        (data.model_mapping && data.model_mapping.trim()) ||
        (data.param_override && data.param_override.trim()) ||
        (data.status_code_mapping && data.status_code_mapping.trim()) ||
        (data.header_override && data.header_override.trim()) ||
        (data.tag && data.tag.trim()) ||
        (data.remark && data.remark.trim()) ||
        (data.priority && data.priority !== 0) ||
        (data.weight && data.weight !== 0) ||
        data.pass_through_body_enabled === true ||
        (data.proxy && data.proxy.trim());
      if (hasAdvancedValues) {
        setAdvancedSettingsOpen(true);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const fetchUpstreamModelList = async (name, options = {}) => {
    const silent = !!options.silent;
    // if (inputs['type'] !== 1) {
    //   showError(t('仅支持 OpenAI 接口格式'));
    //   return;
    // }
    setLoading(true);
    const models = [];
    let err = false;

    if (isEdit) {
      // 如果是编辑模式，使用已有的 channelId 获取模型列表
      const res = await API.get('/api/channel/fetch_models/' + channelId, {
        skipErrorHandler: true,
      });
      if (res && res.data && res.data.success) {
        models.push(...res.data.data);
      } else {
        err = true;
      }
    } else {
      showError(
        t(
          '请先保存渠道；若未在表单中填写密钥，请在保存后于密钥管理中配置再获取模型列表',
        ),
      );
      err = true;
    }

    if (!err) {
      const uniqueModels = Array.from(new Set(models));
      setFetchedModels(uniqueModels);
      if (!silent) {
        setModelModalVisible(true);
      }
      setLoading(false);
      return uniqueModels;
    } else {
      showError(t('获取模型列表失败'));
    }
    setLoading(false);
    return null;
  };

  const openModelMappingValueModal = async ({ pairKey, value }) => {
    const mappingKey = String(pairKey ?? '').trim();
    if (!mappingKey) return;

    if (!MODEL_FETCHABLE_CHANNEL_TYPES.has(inputs.type)) {
      return;
    }

    let modelsToUse = fetchedModels;
    if (!Array.isArray(modelsToUse) || modelsToUse.length === 0) {
      const fetched = await fetchUpstreamModelList('models', { silent: true });
      if (Array.isArray(fetched)) {
        modelsToUse = fetched;
      }
    }

    if (!Array.isArray(modelsToUse) || modelsToUse.length === 0) {
      showInfo(t('暂无模型'));
      return;
    }

    const normalizedModelsToUse = Array.from(
      new Set(
        modelsToUse.map((model) => String(model ?? '').trim()).filter(Boolean),
      ),
    );
    const currentValue = String(value ?? '').trim();

    setModelMappingValueModalModels(normalizedModelsToUse);
    setModelMappingValueKey(mappingKey);
    setModelMappingValueSelected(
      normalizedModelsToUse.includes(currentValue) ? currentValue : '',
    );
    setModelMappingValueModalVisible(true);
  };

  const fetchModels = async () => {
    try {
      let res = await API.get(`/api/channel/models`);
      const localModelOptions = res.data.data.map((model) => {
        const id = (model.id || '').trim();
        return {
          key: id,
          label: id,
          value: id,
        };
      });
      setOriginModelOptions(localModelOptions);
      setFullModels(res.data.data.map((model) => model.id));
      setBasicModels(
        res.data.data
          .filter((model) => {
            return model.id.startsWith('gpt-') || model.id.startsWith('text-');
          })
          .map((model) => model.id),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  const fetchModelGroups = async () => {
    try {
      const res = await API.get('/api/prefill_group?type=model');
      if (res?.data?.success) {
        setModelGroups(res.data.data || []);
      }
    } catch (error) {
      // ignore
    }
  };

  const handleRefreshCodexCredential = async () => {
    if (!isEdit) return;

    setCodexCredentialRefreshing(true);
    try {
      const res = await API.post(
        `/api/channel/${channelId}/codex/refresh`,
        {},
        { skipErrorHandler: true },
      );
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || 'Failed to refresh credential');
      }
      showSuccess(t('凭证已刷新'));
    } catch (error) {
      showError(error.message || t('刷新失败'));
    } finally {
      setCodexCredentialRefreshing(false);
    }
  };

  useEffect(() => {
    if (inputs.type !== 45) {
      doubaoApiClickCountRef.current = 0;
      setDoubaoApiEditUnlocked(false);
    }
  }, [inputs.type]);

  useEffect(() => {
    const modelMap = new Map();

    originModelOptions.forEach((option) => {
      const v = (option.value || '').trim();
      if (!modelMap.has(v)) {
        modelMap.set(v, option);
      }
    });

    inputs.models.forEach((model) => {
      const v = (model || '').trim();
      if (!modelMap.has(v)) {
        modelMap.set(v, {
          key: v,
          label: v,
          value: v,
        });
      }
    });

    const categories = getModelCategories(t);
    const optionsWithIcon = Array.from(modelMap.values()).map((opt) => {
      const modelName = opt.value;
      let icon = null;
      for (const [key, category] of Object.entries(categories)) {
        if (key !== 'all' && category.filter({ model_name: modelName })) {
          icon = category.icon;
          break;
        }
      }
      return {
        ...opt,
        label: (
          <span className='flex items-center gap-1'>
            {icon}
            {modelName}
          </span>
        ),
      };
    });

    setModelOptions(optionsWithIcon);
  }, [originModelOptions, inputs.models, t]);

  useEffect(() => {
    fetchModels().then();
    if (!isEdit) {
      initialBaseUrlRef.current = '';
      setInputs(originInputs);
      if (formApiRef.current) {
        formApiRef.current.setValues(originInputs);
      }
      let localModels = getChannelModels(inputs.type);
      setBasicModels(localModels);
      setInputs((inputs) => ({ ...inputs, models: localModels }));
    }
  }, [props.editingChannel.id]);

  useEffect(() => {
    if (formApiRef.current) {
      formApiRef.current.setValues(inputs);
    }
  }, [inputs]);

  useEffect(() => {
    setModelSearchValue('');
    if (props.visible) {
      if (isEdit) {
        loadChannel();
      } else {
        formApiRef.current?.setValues(getInitValues());
      }
      fetchModelGroups();
      // 重置高级设置折叠状态
      setAdvancedSettingsOpen(false);
    } else {
      // 统一的模态框关闭重置逻辑
      resetModalState();
    }
  }, [props.visible, channelId]);

  useEffect(() => {
    if (!isEdit) {
      initialModelsRef.current = [];
      initialModelMappingRef.current = '';
      initialStatusCodeMappingRef.current = '';
    }
  }, [isEdit, props.visible]);

  useEffect(() => {
    return () => {
      if (statusCodeRiskConfirmResolverRef.current) {
        statusCodeRiskConfirmResolverRef.current(false);
        statusCodeRiskConfirmResolverRef.current = null;
      }
    };
  }, []);

  // 统一的模态框重置函数
  const resetModalState = () => {
    resolveStatusCodeRiskConfirm(false);
    formApiRef.current?.reset();
    // 重置企业账户状态
    setIsEnterpriseAccount(false);
    // 重置豆包隐藏入口状态
    setDoubaoApiEditUnlocked(false);
    doubaoApiClickCountRef.current = 0;
    setModelSearchValue('');
    // 重置高级设置折叠状态
    setAdvancedSettingsOpen(false);
    // 重置本地输入，避免下次打开残留上一次的 JSON 字段值
    setInputs(getInitValues());
  };

  const confirmMissingModelMappings = (missingModels) =>
    new Promise((resolve) => {
      const modal = Modal.confirm({
        title: t('模型未加入列表，可能无法调用'),
        content: (
          <div className='text-sm leading-6'>
            <div>
              {t(
                '模型重定向里的下列模型尚未添加到“模型”列表，调用时会因为缺少可用模型而失败：',
              )}
            </div>
            <div className='font-mono text-xs break-all text-red-600 mt-1'>
              {missingModels.join(', ')}
            </div>
            <div className='mt-2'>
              {t(
                '你可以在“自定义模型名称”处手动添加它们，然后点击填入后再提交，或者直接使用下方操作自动处理。',
              )}
            </div>
          </div>
        ),
        centered: true,
        footer: (
          <Space align='center' className='w-full justify-end'>
            <Button
              type='tertiary'
              onClick={() => {
                modal.destroy();
                resolve('cancel');
              }}
            >
              {t('返回修改')}
            </Button>
            <Button
              type='primary'
              theme='light'
              onClick={() => {
                modal.destroy();
                resolve('submit');
              }}
            >
              {t('直接提交')}
            </Button>
            <Button
              type='primary'
              theme='solid'
              onClick={() => {
                modal.destroy();
                resolve('add');
              }}
            >
              {t('添加后提交')}
            </Button>
          </Space>
        ),
      });
    });

  const resolveStatusCodeRiskConfirm = (confirmed) => {
    setStatusCodeRiskConfirmVisible(false);
    setStatusCodeRiskDetailItems([]);
    if (statusCodeRiskConfirmResolverRef.current) {
      statusCodeRiskConfirmResolverRef.current(confirmed);
      statusCodeRiskConfirmResolverRef.current = null;
    }
  };

  const confirmStatusCodeRisk = (detailItems) =>
    new Promise((resolve) => {
      statusCodeRiskConfirmResolverRef.current = resolve;
      setStatusCodeRiskDetailItems(detailItems);
      setStatusCodeRiskConfirmVisible(true);
    });

  const hasModelConfigChanged = (normalizedModels, modelMappingStr) => {
    if (!isEdit) return true;
    const initialModels = initialModelsRef.current;
    if (normalizedModels.length !== initialModels.length) {
      return true;
    }
    for (let i = 0; i < normalizedModels.length; i++) {
      if (normalizedModels[i] !== initialModels[i]) {
        return true;
      }
    }
    const normalizedMapping = (modelMappingStr || '').trim();
    const initialMapping = (initialModelMappingRef.current || '').trim();
    return normalizedMapping !== initialMapping;
  };

  const submit = async () => {
    const formValues = formApiRef.current ? formApiRef.current.getValues() : {};
    let localInputs = { ...formValues };
    localInputs.param_override = inputs.param_override;

    if (!isEdit && !localInputs.name) {
      showInfo(t('请填写渠道名称！'));
      return;
    }
    if (!Array.isArray(localInputs.models)) {
      localInputs.models = [];
    }
    if (
      localInputs.type === 45 &&
      (!localInputs.base_url || localInputs.base_url.trim() === '')
    ) {
      showInfo(t('请输入API地址！'));
      return;
    }
    const hasModelMapping =
      typeof localInputs.model_mapping === 'string' &&
      localInputs.model_mapping.trim() !== '';
    let parsedModelMapping = null;
    if (hasModelMapping) {
      if (!verifyJSON(localInputs.model_mapping)) {
        showInfo(t('模型映射必须是合法的 JSON 格式！'));
        return;
      }
      try {
        parsedModelMapping = JSON.parse(localInputs.model_mapping);
      } catch (error) {
        showInfo(t('模型映射必须是合法的 JSON 格式！'));
        return;
      }
    }

    const normalizedModels = (localInputs.models || [])
      .map((model) => (model || '').trim())
      .filter(Boolean);
    localInputs.models = normalizedModels;

    if (
      parsedModelMapping &&
      typeof parsedModelMapping === 'object' &&
      !Array.isArray(parsedModelMapping)
    ) {
      const modelSet = new Set(normalizedModels);
      const missingModels = Object.keys(parsedModelMapping)
        .map((key) => (key || '').trim())
        .filter((key) => key && !modelSet.has(key));
      const shouldPromptMissing =
        missingModels.length > 0 &&
        hasModelConfigChanged(normalizedModels, localInputs.model_mapping);
      if (shouldPromptMissing) {
        const confirmAction = await confirmMissingModelMappings(missingModels);
        if (confirmAction === 'cancel') {
          return;
        }
        if (confirmAction === 'add') {
          const updatedModels = Array.from(
            new Set([...normalizedModels, ...missingModels]),
          );
          localInputs.models = updatedModels;
          handleInputChange('models', updatedModels);
        }
      }
    }

    const invalidStatusCodeEntries = collectInvalidStatusCodeEntries(
      localInputs.status_code_mapping,
    );
    if (invalidStatusCodeEntries.length > 0) {
      showError(
        `${t('状态码复写包含无效的状态码')}: ${invalidStatusCodeEntries.join(', ')}`,
      );
      return;
    }

    const riskyStatusCodeRedirects = collectNewDisallowedStatusCodeRedirects(
      initialStatusCodeMappingRef.current,
      localInputs.status_code_mapping,
    );
    if (riskyStatusCodeRedirects.length > 0) {
      const confirmed = await confirmStatusCodeRisk(riskyStatusCodeRedirects);
      if (!confirmed) {
        return;
      }
    }

    if (localInputs.base_url && localInputs.base_url.endsWith('/')) {
      localInputs.base_url = localInputs.base_url.slice(
        0,
        localInputs.base_url.length - 1,
      );
    }
    if (localInputs.type === 18 && localInputs.other === '') {
      localInputs.other = 'v2.1';
    }

    // 处理 settings 字段（企业账户设置）
    let settings = {};
    if (localInputs.settings) {
      try {
        settings = JSON.parse(localInputs.settings);
      } catch (error) {
        console.error('解析settings失败:', error);
      }
    }

    // type === 20: 设置企业账户标识，无论是true还是false都要传到后端
    if (localInputs.type === 20) {
      settings.openrouter_enterprise =
        localInputs.is_enterprise_account === true;
    }

    localInputs.settings = JSON.stringify(settings);

    // 处理 setting 字段（ChannelSettings，包含透传请求体等）
    let channelSetting = {};
    if (localInputs.setting) {
      try {
        channelSetting = JSON.parse(localInputs.setting);
      } catch (error) {
        console.error('解析渠道设置失败:', error);
      }
    }
    channelSetting.pass_through_body_enabled =
      localInputs.pass_through_body_enabled === true;
    if (localInputs.proxy && localInputs.proxy.trim()) {
      channelSetting.proxy = localInputs.proxy.trim();
    } else {
      delete channelSetting.proxy;
    }
    localInputs.setting = JSON.stringify(channelSetting);

    // 清理不需要发送到后端的字段
    delete localInputs.is_enterprise_account;
    delete localInputs.pass_through_body_enabled;
    delete localInputs.proxy;

    let res;
    localInputs.auto_ban = localInputs.auto_ban ? 1 : 0;
    localInputs.models = localInputs.models.join(',');
    const groupsForSubmit = Array.isArray(localInputs.groups) && localInputs.groups.length > 0
      ? localInputs.groups
      : (Array.isArray(inputs.groups) && inputs.groups.length > 0 ? inputs.groups : ['default']);
    localInputs.groups = groupsForSubmit;
    localInputs.group = groupsForSubmit.join(',');

    const keyRaw = typeof localInputs.key === 'string' ? localInputs.key : '';
    if (isEdit) {
      const k = keyRaw.trim();
      if (!k) {
        delete localInputs.key;
      } else if (k.startsWith('[')) {
        localInputs.key = k;
      } else {
        const lines = k
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        localInputs.key = lines.join('\n');
      }
      res = await API.put(`/api/channel/`, {
        ...localInputs,
        id: parseInt(channelId),
      });
    } else {
      let mode = 'single';
      let multiKeyMode = 'random';
      let keyVal = '';
      const trimmedAll = keyRaw.trim();
      if (trimmedAll) {
        if (localInputs.type === 57 || trimmedAll.startsWith('[')) {
          keyVal = trimmedAll;
        } else {
          const lines = keyRaw
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          if (lines.length > 1) {
            mode = 'multi_to_single';
            keyVal = lines.join('\n');
          } else {
            keyVal = lines[0] || '';
          }
        }
      }
      localInputs.key = keyVal;
      res = await API.post('/api/channel/', {
        mode,
        multi_key_mode: multiKeyMode,
        channel: localInputs,
      });
    }
    const { success, message } = res.data;
    if (success) {
      if (isEdit) {
        showSuccess(t('渠道更新成功！'));
      } else {
        showSuccess(t('渠道创建成功！'));
        setInputs(originInputs);
      }
      props.refresh();
      props.handleClose();
    } else {
      showError(message);
    }
  };

  // 密钥去重函数
  const addCustomModels = () => {
    if (customModel.trim() === '') return;
    const modelArray = customModel.split(',').map((model) => model.trim());

    let localModels = [...inputs.models];
    let localModelOptions = [...modelOptions];
    const addedModels = [];

    modelArray.forEach((model) => {
      if (model && !localModels.includes(model)) {
        localModels.push(model);
        localModelOptions.push({
          key: model,
          label: model,
          value: model,
        });
        addedModels.push(model);
      }
    });

    setModelOptions(localModelOptions);
    setCustomModel('');
    handleInputChange('models', localModels);

    if (addedModels.length > 0) {
      showSuccess(
        t('已新增 {{count}} 个模型：{{list}}', {
          count: addedModels.length,
          list: addedModels.join(', '),
        }),
      );
    } else {
      showInfo(t('未发现新增模型'));
    }
  };

  const channelOptionList = useMemo(
    () =>
      CHANNEL_OPTIONS.map((opt) => ({
        ...opt,
        // 保持 label 为纯文本以支持搜索
        label: opt.label,
      })),
    [],
  );

  const renderChannelOption = (renderProps) => {
    const {
      disabled,
      selected,
      label,
      value,
      focused,
      className,
      style,
      onMouseEnter,
      onClick,
      ...rest
    } = renderProps;

    const searchWords = channelSearchValue ? [channelSearchValue] : [];

    // 构建样式类名
    const optionClassName = [
      'flex items-center gap-3 px-3 py-2 transition-all duration-200 rounded-lg mx-2 my-1',
      focused && 'bg-blue-50 shadow-sm',
      selected &&
        'bg-blue-100 text-blue-700 shadow-lg ring-2 ring-blue-200 ring-opacity-50',
      disabled && 'opacity-50 cursor-not-allowed',
      !disabled && 'hover:bg-gray-50 hover:shadow-md cursor-pointer',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        style={style}
        className={optionClassName}
        onClick={() => !disabled && onClick()}
        onMouseEnter={(e) => onMouseEnter()}
      >
        <div className='flex items-center gap-3 w-full'>
          <div className='flex-shrink-0 w-5 h-5 flex items-center justify-center'>
            {getChannelIcon(value)}
          </div>
          <div className='flex-1 min-w-0'>
            <Highlight
              sourceString={label}
              searchWords={searchWords}
              className='text-sm font-medium truncate'
            />
          </div>
          {selected && (
            <div className='flex-shrink-0 text-blue-600'>
              <svg
                width='16'
                height='16'
                viewBox='0 0 16 16'
                fill='currentColor'
              >
                <path d='M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z' />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <SideSheet
        placement={isEdit ? 'right' : 'left'}
        title={
          <Space>
            <Tag color='blue' shape='circle'>
              {isEdit ? t('编辑') : t('新建')}
            </Tag>
            <Title heading={4} className='m-0'>
              {isEdit ? t('更新渠道信息') : t('创建新的渠道')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={props.visible}
        width={isMobile ? '100%' : 600}
        footer={
          <div className='flex justify-end items-center gap-2'>
            <Button
              theme='solid'
              onClick={() => formApiRef.current?.submitForm()}
              icon={<IconSave />}
            >
              {t('提交')}
            </Button>
            <Button
              theme='light'
              type='primary'
              onClick={handleCancel}
              icon={<IconClose />}
            >
              {t('取消')}
            </Button>
          </div>
        }
        closeIcon={null}
        onCancel={() => handleCancel()}
      >
        <Form
          key={isEdit ? 'edit' : 'new'}
          initValues={originInputs}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
        >
          {() => {
            const advancedSettingsContent = (
              <div className='space-y-4'>
                {/* Request Config Section */}
                <div className='py-3 border-b border-gray-100'>
                  <Text className='text-sm font-medium text-gray-500 mb-3 block'>
                    {t('请求配置')}
                  </Text>

                  <div className='flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl mb-2'
                    style={{ border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-bg-0)' }}>
                    <div className='flex-1 min-w-0'>
                      <div className='text-sm font-medium leading-5'>{t('透传请求体')}</div>
                      <div className='text-xs mt-0.5' style={{ color: 'var(--semi-color-text-2)' }}>
                        {t('开启后请求体将直接透传给上游，参数覆写、模型重定向、渠道适配等内置功能将失效，请谨慎开启')}
                      </div>
                    </div>
                    <Form.Switch
                      field='pass_through_body_enabled'
                      noLabel
                      style={{ marginBottom: 0 }}
                      onChange={(value) => handleInputChange('pass_through_body_enabled', value)}
                      initValue={inputs.pass_through_body_enabled}
                    />
                  </div>

                  {inputs.pass_through_body_enabled && (
                    <Banner
                      type='warning'
                      closeIcon={null}
                      className='!rounded-lg mb-2'
                      description={t('该渠道已开启请求透传：参数覆写、模型重定向、渠道适配等内置功能将失效，非最佳实践；如因此产生问题，请勿提交 issue 反馈。')}
                    />
                  )}

                  <Form.TextArea
                    field='param_override'
                    label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('参数覆盖')}</span>}
                    placeholder={t('JSON 格式，覆盖请求参数')}
                    autosize={{ minRows: 3, maxRows: 10 }}
                    onChange={(value) => handleInputChange('param_override', value)}
                    showClear
                    extraText={
                      <Text
                        className='!text-semi-color-primary cursor-pointer underline'
                        onClick={() => formatJsonField('param_override')}
                      >
                        {t('格式化')}
                      </Text>
                    }
                  />

                  <Form.TextArea
                    field='header_override'
                    label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('请求头覆盖')}</span>}
                    placeholder={t('JSON 格式，覆盖请求头')}
                    autosize={{ minRows: 3, maxRows: 10 }}
                    onChange={(value) =>
                      handleInputChange('header_override', value)
                    }
                    extraText={
                      <Space>
                        <Text
                          className='!text-semi-color-primary cursor-pointer underline'
                          onClick={() =>
                            handleInputChange(
                              'header_override',
                              JSON.stringify({ '*': true, Authorization: 'Bearer {api_key}' }, null, 2),
                            )
                          }
                        >
                          {t('填入模板')}
                        </Text>
                        <Text
                          className='!text-semi-color-primary cursor-pointer underline'
                          onClick={() => formatJsonField('header_override')}
                        >
                          {t('格式化')}
                        </Text>
                      </Space>
                    }
                    showClear
                  />
                  <JSONEditor
                    key={`status_code_mapping-${isEdit ? channelId : 'new'}`}
                    field='status_code_mapping'
                    label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('状态码复写')}</span>}
                    placeholder={t('键值对，覆盖状态码')}
                    value={inputs.status_code_mapping || ''}
                    onChange={(value) =>
                      handleInputChange('status_code_mapping', value)
                    }
                    template={STATUS_CODE_MAPPING_EXAMPLE}
                    templateLabel={t('填入模板')}
                    editorType='keyValue'
                    formApi={formApiRef.current}
                    extraText={t('本地状态码映射')}
                  />

                  <Form.Input
                    field='proxy'
                    label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('代理地址')}</span>}
                    placeholder={t('例如: socks5://user:pass@host:port')}
                    showClear
                    onChange={(value) => handleInputChange('proxy', value)}
                    extraText={t('支持 socks5')}
                  />
                </div>

                {/* Channel Behavior Section */}
                <div className='py-3 border-b border-gray-100'>
                  <Text className='text-sm font-medium text-gray-500 mb-3 block'>
                    {t('渠道行为')}
                  </Text>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.InputNumber
                        field='priority'
                        label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('渠道优先级')}</span>}
                        placeholder={t('渠道优先级')}
                        min={0}
                        onNumberChange={(value) => handleInputChange('priority', value)}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={12}>
                      <Form.InputNumber
                        field='weight'
                        label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('渠道权重')}</span>}
                        placeholder={t('渠道权重')}
                        min={0}
                        onNumberChange={(value) => handleInputChange('weight', value)}
                        style={{ width: '100%' }}
                      />
                    </Col>
                  </Row>

                </div>
              </div>
            );

            return (
            <>
            <Spin spinning={loading}>
              <div className='p-2 space-y-3' ref={formContainerRef}>
                {/* Core Configuration Card - Always Visible */}
                <Card className='!rounded-2xl shadow-sm border-0'>
                  {/* Header */}
                  <div className='flex items-center mb-4'>
                    <Avatar
                      size='small'
                      color='blue'
                      className='mr-2 shadow-md'
                    >
                      <IconServer size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('核心配置')}
                      </Text>
                    </div>
                  </div>

                    {isIonetChannel && (
                      <Banner
                        type='info'
                        closeIcon={null}
                        className='mb-4 rounded-xl'
                        description={t(
                          '此渠道由 IO.NET 自动同步，类型、密钥和 API 地址已锁定。',
                        )}
                      >
                        <Space>
                          {ionetMetadata?.deployment_id && (
                            <Button
                              size='small'
                              theme='light'
                              type='primary'
                              icon={<IconGlobe />}
                              onClick={handleOpenIonetDeployment}
                            >
                              {t('查看关联部署')}
                            </Button>
                          )}
                        </Space>
                      </Banner>
                    )}

                    <Form.Select
                      field='type'
                      label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('类型')}</span>}
                      placeholder={t('请选择渠道类型')}
                      rules={[{ required: true, message: t('请选择渠道类型') }]}
                      optionList={channelOptionList}
                      style={{ width: '100%' }}
                      filter={selectFilter}
                      autoClearSearchValue={false}
                      searchPosition='dropdown'
                      onSearch={(value) => setChannelSearchValue(value)}
                      renderOptionItem={renderChannelOption}
                      onChange={(value) => handleInputChange('type', value)}
                      disabled={isIonetLocked}
                    />

                    {inputs.type === 57 && (
                      <Banner
                        type='warning'
                        closeIcon={null}
                        className='mb-4 rounded-xl'
                        description={t('仅限个人使用，凭证仅供 Codex CLI，请遵守 OpenAI 相关政策。')}
                      />
                    )}

                    {inputs.type === 20 && (
                      <div className='flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl mb-2'
                        style={{ border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-bg-0)' }}>
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium leading-5'>{t('是否为企业账户')}</div>
                          <div className='text-xs mt-0.5' style={{ color: 'var(--semi-color-text-2)' }}>{t('企业账户返回格式特殊，非企业账户勿开启')}</div>
                        </div>
                        <Form.Switch
                          field='is_enterprise_account'
                          checkedText={t('是')}
                          uncheckedText={t('否')}
                          noLabel
                          style={{ marginBottom: 0 }}
                          onChange={(value) => {
                            setIsEnterpriseAccount(value);
                            handleInputChange('is_enterprise_account', value);
                          }}
                          initValue={inputs.is_enterprise_account}
                        />
                      </div>
                    )}

                    <Form.Input
                      field='name'
                      label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('名称')}</span>}
                      placeholder={t('渠道名称')}
                      rules={[{ required: true, message: t('请为渠道命名') }]}
                      showClear
                      onChange={(value) => handleInputChange('name', value)}
                      autoComplete='new-password'
                    />

                    {inputs.type === 18 && (
                      <Form.Input
                        field='other'
                        label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('模型版本')}</span>}
                        placeholder={
                          'v2.1'
                        }
                        onChange={(value) => handleInputChange('other', value)}
                        showClear
                      />
                    )}

                    {inputs.type === 41 && (
                      <JSONEditor
                        key={`region-${isEdit ? channelId : 'new'}`}
                        field='other'
                        label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('部署地区')}</span>}
                        placeholder={t('如：us-central1')}
                        value={inputs.other || ''}
                        onChange={(value) => handleInputChange('other', value)}
                        rules={[
                          { required: true, message: t('请填写部署地区') },
                        ]}
                        template={REGION_EXAMPLE}
                        templateLabel={t('填入模板')}
                        editorType='region'
                        formApi={formApiRef.current}
                      />
                    )}

                    {inputs.type === 21 && (
                      <Form.Input
                        field='other'
                        label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('知识库 ID')}</span>}
                        placeholder={'知识库ID'}
                        onChange={(value) => handleInputChange('other', value)}
                        showClear
                      />
                    )}

                    {inputs.type === 39 && (
                      <Form.Input
                        field='other'
                        label='Account ID'
                        placeholder={
                          '请输入Account ID，例如：d6b5da8hk1awo8nap34ube6gh'
                        }
                        onChange={(value) => handleInputChange('other', value)}
                        showClear
                      />
                    )}

                    {inputs.type === 49 && (
                      <Form.Input
                        field='other'
                        label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('智能体ID')}</span>}
                        placeholder={'智能体ID'}
                        onChange={(value) => handleInputChange('other', value)}
                        showClear
                      />
                    )}

                    {inputs.type === 1 && (
                      <Form.Input
                        field='openai_organization'
                        label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('组织')}</span>}
                        placeholder={t('请输入组织org-xxx')}
                        showClear
                        helpText={t('组织，不填则为默认组织')}
                        onChange={(value) =>
                          handleInputChange('openai_organization', value)
                        }
                      />
                    )}

                  {/* API Configuration Section */}
                  {showApiConfigCard && (
                    <div onClick={handleApiConfigSecretClick}>

                      {inputs.type === 40 && (
                        <Banner
                          type='info'
                          description={
                            <div>
                              <Text strong>{t('邀请链接')}:</Text>
                              <Text
                                link
                                underline
                                className='ml-2 cursor-pointer'
                                onClick={() =>
                                  window.open(
                                    'https://cloud.siliconflow.cn/i/hij0YNTZ',
                                  )
                                }
                              >
                                https://cloud.siliconflow.cn/i/hij0YNTZ
                              </Text>
                            </div>
                          }
                          className='!rounded-lg'
                        />
                      )}

                      {inputs.type === 3 && (
                        <>
                          <Banner
                            type='warning'
                            description={t('2025-05-10 后添加的渠道无需移除模型名中的"."')}
                            className='!rounded-lg'
                          />
                          <div>
                            <Form.Input
                              field='base_url'
                              label='AZURE_OPENAI_ENDPOINT'
                        placeholder='https://docs-test-001.openai.azure.com'
                              onChange={(value) =>
                                handleInputChange('base_url', value)
                              }
                              showClear
                              disabled={isIonetLocked}
                            />
                          </div>
                          <div>
                            <Form.Input
                              field='other'
                              label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('默认 API 版本')}</span>}
                              placeholder='2025-04-01-preview'
                              onChange={(value) =>
                                handleInputChange('other', value)
                              }
                              showClear
                            />
                          </div>
                          <div>
                            <Form.Input
                              field='azure_responses_version'
                              label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('默认 Responses API 版本，为空则使用上方版本')}</span>}
                              placeholder={t('如：preview')}
                              onChange={(value) =>
                                handleChannelOtherSettingsChange(
                                  'azure_responses_version',
                                  value,
                                )
                              }
                              showClear
                            />
                          </div>
                        </>
                      )}

                      {inputs.type === 8 && (
                        <>
                          <Banner
                            type='warning'
                            description={t('对接转发项目（One API/New API 等）请使用 OpenAI 类型，而非此类型。')}
                            className='!rounded-lg'
                          />
                          <div>
                            <Form.Input
                              field='base_url'
                              label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('完整的 Base URL，支持变量{model}')}</span>}
                              placeholder='https://api.openai.com/v1/chat/completions'
                              onChange={(value) =>
                                handleInputChange('base_url', value)
                              }
                              showClear
                              disabled={isIonetLocked}
                            />
                          </div>
                        </>
                      )}

                      {inputs.type === 37 && (
                        <Banner
                          type='warning'
                        description={t('仅适配 chatflow 和 agent，agent 不支持图片')}
                          className='!rounded-lg'
                        />
                      )}

                      {inputs.type !== 3 &&
                        inputs.type !== 8 &&
                        inputs.type !== 22 &&
                        inputs.type !== 36 &&
                        (inputs.type !== 45 || doubaoApiEditUnlocked) && (
                          <div>
                            <Form.Input
                              field='base_url'
                              label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('API地址')}</span>}
                          placeholder={t('选填，末尾不带 /v1')}
                              onChange={(value) =>
                                handleInputChange('base_url', value)
                              }
                              showClear
                              disabled={isIonetLocked}
                              extraText={t('默认官方地址')}
                            />
                          </div>
                        )}

                      {inputs.type === 22 && (
                        <div>
                          <Form.Input
                            field='base_url'
                            label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('私有部署地址')}</span>}
                            placeholder='https://fastgpt.run/api/openapi'
                            onChange={(value) =>
                              handleInputChange('base_url', value)
                            }
                            showClear
                            disabled={isIonetLocked}
                          />
                        </div>
                      )}

                      {inputs.type === 36 && (
                        <div>
                          <Form.Input
                            field='base_url'
                            label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('API 地址（非 Chat API）')}</span>}
                            placeholder='https://api.example.com'
                            onChange={(value) =>
                              handleInputChange('base_url', value)
                            }
                            showClear
                            disabled={isIonetLocked}
                          />
                        </div>
                      )}

                      {inputs.type === 45 && !doubaoApiEditUnlocked && (
                        <div>
                          <Form.Select
                            field='base_url'
                            label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('API地址')}</span>}
                            placeholder={t('请选择API地址')}
                            onChange={(value) =>
                              handleInputChange('base_url', value)
                            }
                            optionList={[
                              {
                                value: 'https://ark.cn-beijing.volces.com',
                                label: 'https://ark.cn-beijing.volces.com',
                              },
                              {
                                value:
                                  'https://ark.ap-southeast.bytepluses.com',
                                label:
                                  'https://ark.ap-southeast.bytepluses.com',
                              },
                              {
                                value: DEPRECATED_DOUBAO_CODING_PLAN_BASE_URL,
                                label: doubaoCodingPlanOptionLabel,
                                disabled: !canKeepDeprecatedDoubaoCodingPlan,
                              },
                            ]}
                            defaultValue='https://ark.cn-beijing.volces.com'
                            disabled={isIonetLocked}
                          />
                        </div>
                      )}

                      {!isIonetLocked && (
                        <div className='mt-2'>
                          <Form.TextArea
                            field='key'
                            label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('密钥')}</span>}
                            placeholder={type2secretPrompt(inputs.type)}
                            extraText={
                              isEdit
                                ? t('批量覆盖密钥，一行一个')
                                : t('一行一个密钥')
                            }
                            autosize={{ minRows: 3, maxRows: 12 }}
                            onChange={(value) => handleInputChange('key', value)}
                            style={{ fontFamily: 'monospace', fontSize: 13 }}
                            autoComplete='new-password'
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Model Selection - Part of Core Config */}
                  <Form.Select
                      field='models'
                      label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('模型')}</span>}
                      placeholder={t('请选择该渠道所支持的模型')}
                      rules={[]}
                      multiple
                      filter={selectFilter}
                      allowCreate
                      autoClearSearchValue={false}
                      searchPosition='dropdown'
                      optionList={modelOptions}
                      onSearch={(value) => setModelSearchValue(value)}
                      innerBottomSlot={
                        modelSearchHintText ? (
                          <Text className='px-3 py-2 block text-xs !text-semi-color-text-2'>
                            {modelSearchHintText}
                          </Text>
                        ) : null
                      }
                      style={{ width: '100%' }}
                      onChange={(value) => handleInputChange('models', value)}
                      renderSelectedItem={(optionNode) => {
                        const modelName = String(optionNode?.value ?? '');
                        return {
                          isRenderInTag: true,
                          content: (
                            <span
                              className='cursor-pointer select-none'
                              role='button'
                              tabIndex={0}
                              title={t('点击复制模型名称')}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await copy(modelName);
                                if (ok) {
                                  showSuccess(
                                    t('已复制：{{name}}', { name: modelName }),
                                  );
                                } else {
                                  showError(t('复制失败'));
                                }
                              }}
                            >
                              {optionNode.label || modelName}
                            </span>
                          ),
                        };
                      }}
                      extraText={
                        <Space>
                          {MODEL_FETCHABLE_CHANNEL_TYPES.has(inputs.type) && (
                            <Button
                              size='small'
                              type='tertiary'
                              onClick={() => fetchUpstreamModelList('models')}
                            >
                              {t('获取模型列表')}
                            </Button>
                          )}
                          <Button
                            size='small'
                            type='tertiary'
                            onClick={() => {
                              if (!inputs.models || inputs.models.length === 0) { showInfo(t('没有模型可以复制')); return; }
                              try { copy(inputs.models.join(',')); showSuccess(t('模型列表已复制到剪贴板')); } catch (error) { showError(t('复制失败')); }
                            }}
                          >
                            {t('复制所有模型')}
                          </Button>
                          <Button
                            size='small'
                            type='danger'
                            onClick={() => handleInputChange('models', [])}
                          >
                            {t('清除所有模型')}
                          </Button>
                        </Space>
                      }
                    />

                  {/* Custom Model Name - Core Config */}
                  <Form.Input
                    field='custom_model'
                    label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('自定义模型名称')}</span>}
                    placeholder={t('输入自定义模型名称')}
                    onChange={(value) => setCustomModel(value.trim())}
                    value={customModel}
                    suffix={
                      <Button
                        size='small'
                        type='primary'
                        onClick={addCustomModels}
                      >
                        {t('填入')}
                      </Button>
                    }
                  />

                  {/* Model Mapping - Core Config */}
                  <JSONEditor
                    key={`model_mapping-${isEdit ? channelId : 'new'}`}
                    field='model_mapping'
                    label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('模型重定向')}</span>}
                    placeholder={t('键值对，模型重定向')}
                    value={inputs.model_mapping || ''}
                    onChange={(value) =>
                      handleInputChange('model_mapping', value)
                    }
                    template={MODEL_MAPPING_EXAMPLE}
                    templateLabel={t('填入模板')}
                    editorType='keyValue'
                    formApi={formApiRef.current}
                    renderStringValueSuffix={({ pairKey, value }) => {
                      if (!MODEL_FETCHABLE_CHANNEL_TYPES.has(inputs.type)) {
                        return null;
                      }
                      const disabled = !String(pairKey ?? '').trim();
                      return (
                        <Tooltip content={t('选择模型')}>
                          <Button
                            type='tertiary'
                            theme='borderless'
                            size='small'
                            icon={<IconSearch size={14} />}
                            disabled={disabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              openModelMappingValueModal({ pairKey, value });
                            }}
                          />
                        </Tooltip>
                      );
                    }}
                    extraText={t('请求模型→替换模型')}
                  />

                  {/* Auto Ban - Core Config */}
                  <div className='flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl'
                    style={{ border: '1px solid var(--semi-color-border)', background: 'var(--semi-color-bg-0)' }}>
                    <div className='flex-1 min-w-0'>
                      <div className='text-sm font-medium leading-5'>{t('是否自动禁用')}</div>
                      <div className='text-xs mt-0.5' style={{ color: 'var(--semi-color-text-2)' }}>{t('关闭后不会自动禁用该渠道')}</div>
                    </div>
                    <Form.Switch
                      field='auto_ban'
                      checkedText={t('开')}
                      uncheckedText={t('关')}
                      noLabel
                      style={{ marginBottom: 0 }}
                      onChange={(value) => setAutoBan(value)}
                      initValue={autoBan}
                    />
                  </div>

                  {/* Test Model - Core Config */}
                  <Form.Input
                    style={{ marginTop: 12 }}
                    field='test_model'
                    label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('默认测试模型')}</span>}
                    placeholder={t('默认取列表首个')}
                    onChange={(value) =>
                      handleInputChange('test_model', value)
                    }
                    showClear
                  />
                </Card>

                {/* Advanced Settings Toggle / Collapse */}
                {isMobile ? (
                <Collapse
                  activeKey={advancedSettingsOpen ? ['advanced'] : []}
                  onChange={(keys) => setAdvancedSettingsOpen(keys.includes('advanced'))}
                >
                  <Collapse.Panel
                    header={
                      <div className='flex items-center gap-2'>
                        <IconSetting size={16} />
                        <Text className='font-medium'>{t('高级设置')}</Text>
                      </div>
                    }
                    itemKey='advanced'
                  >
                    {advancedSettingsContent}
                  </Collapse.Panel>
                </Collapse>
                ) : (
                  /* Desktop: toggle button to open side panel */
                  <div
                    className='flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-50'
                    style={{
                      backgroundColor: advancedSettingsOpen ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-fill-0)',
                      border: '1px solid var(--semi-color-fill-2)',
                    }}
                    onClick={() => setAdvancedSettingsOpen(!advancedSettingsOpen)}
                  >
                    <div className='flex items-center gap-2'>
                      <IconSetting size={16} />
                      <Text className='font-medium'>{t('高级设置')}</Text>
                    </div>
                    <div className='flex items-center gap-1 text-sm' style={{ color: 'var(--semi-color-primary)' }}>
                      <Text size='small' style={{ color: 'var(--semi-color-primary)' }}>
                        {advancedSettingsOpen ? t('收起') : isEdit ? t('向左展开') : t('向右展开')}
                      </Text>
                      <IconChevronDown
                        size={14}
                        style={{
                          transform: advancedSettingsOpen
                            ? 'rotate(180deg)'
                            : isEdit ? 'rotate(90deg)' : 'rotate(-90deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Spin>

            {/* Desktop: Advanced Settings Side Panel - rendered inside Form tree */}
            {!isMobile && advancedSettingsOpen && (
              <div
                className='fixed top-0 h-full overflow-y-auto z-[999] semi-sidesheet-inner'
                style={{
                  width: 600,
                  [isEdit ? 'right' : 'left']: 600,
                  backgroundColor: 'var(--semi-color-bg-0)',
                  borderLeft: isEdit ? 'none' : '1px solid var(--semi-color-border)',
                  borderRight: isEdit ? '1px solid var(--semi-color-border)' : 'none',
                  animation: `slideIn${isEdit ? 'Left' : 'Right'} 0.3s ease-out`,
                }}
              >
                <div className='semi-sidesheet-header'>
                  <div className='semi-sidesheet-title'>
                    <Space>
                      <Tag color='cyan' shape='circle'>
                        {t('高级')}
                      </Tag>
                      <Title heading={4} className='m-0'>
                        {t('高级设置')}
                      </Title>
                    </Space>
                  </div>
                  <Button
                    className='semi-sidesheet-close'
                    type='tertiary'
                    theme='borderless'
                    icon={<IconClose />}
                    size='small'
                    onClick={() => setAdvancedSettingsOpen(false)}
                  />
                </div>
                <div className='semi-sidesheet-body' style={{ padding: 0 }}>
                  <div className='p-2 space-y-3'>
                    <Card className='!rounded-2xl shadow-sm border-0'>
                      <div className='flex items-center mb-4'>
                        <Avatar
                          size='small'
                          color='orange'
                          className='mr-2 shadow-md'
                        >
                          <IconSetting size={16} />
                        </Avatar>
                        <div>
                          <Text className='text-lg font-medium'>
                            {t('高级设置')}
                          </Text>
                          <div className='text-xs text-gray-600'>
                            {t('渠道的高级配置选项')}
                          </div>
                        </div>
                      </div>
                      {advancedSettingsContent}
                    </Card>
                  </div>
                </div>
              </div>
            )}
            </>
          );
          }}
        </Form>

        <ImagePreview
          src={modalImageUrl}
          visible={isModalOpenurl}
          onVisibleChange={(visible) => setIsModalOpenurl(visible)}
        />
      </SideSheet>
      <StatusCodeRiskGuardModal
        visible={statusCodeRiskConfirmVisible}
        detailItems={statusCodeRiskDetailItems}
        onCancel={() => resolveStatusCodeRiskConfirm(false)}
        onConfirm={() => resolveStatusCodeRiskConfirm(true)}
      />
      <ModelSelectModal
        visible={modelModalVisible}
        models={fetchedModels}
        selected={inputs.models}
        redirectModels={redirectModelList}
        onConfirm={(selectedModels) => {
          handleInputChange('models', selectedModels);
          showSuccess(t('模型列表已更新'));
          setModelModalVisible(false);
        }}
        onCancel={() => setModelModalVisible(false)}
      />

      <SingleModelSelectModal
        visible={modelMappingValueModalVisible}
        models={modelMappingValueModalModels}
        selected={modelMappingValueSelected}
        onConfirm={(selectedModel) => {
          const modelName = String(selectedModel ?? '').trim();
          if (!modelName) {
            showError(t('请先选择模型！'));
            return;
          }

          const mappingKey = String(modelMappingValueKey ?? '').trim();
          if (!mappingKey) {
            setModelMappingValueModalVisible(false);
            return;
          }

          let parsed = {};
          const currentMapping = inputs.model_mapping;
          if (typeof currentMapping === 'string' && currentMapping.trim()) {
            try {
              parsed = JSON.parse(currentMapping);
            } catch (error) {
              parsed = {};
            }
          } else if (
            currentMapping &&
            typeof currentMapping === 'object' &&
            !Array.isArray(currentMapping)
          ) {
            parsed = currentMapping;
          }
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            parsed = {};
          }

          parsed[mappingKey] = modelName;
          const nextMapping = JSON.stringify(parsed, null, 2);
          handleInputChange('model_mapping', nextMapping);
          if (formApiRef.current) {
            formApiRef.current.setValue('model_mapping', nextMapping);
          }
          setModelMappingValueModalVisible(false);
        }}
        onCancel={() => setModelMappingValueModalVisible(false)}
      />

      <OllamaModelModal
        visible={ollamaModalVisible}
        onCancel={() => setOllamaModalVisible(false)}
        channelId={channelId}
        channelInfo={inputs}
        onModelsUpdate={(options = {}) => {
          // 当模型更新后，重新获取模型列表以更新表单
          fetchUpstreamModelList('models', { silent: !!options.silent });
        }}
        onApplyModels={({ mode, modelIds } = {}) => {
          if (!Array.isArray(modelIds) || modelIds.length === 0) {
            return;
          }
          const existingModels = Array.isArray(inputs.models)
            ? inputs.models.map(String)
            : [];
          const incoming = modelIds.map(String);
          const nextModels = Array.from(
            new Set([...existingModels, ...incoming]),
          );

          handleInputChange('models', nextModels);
          if (formApiRef.current) {
            formApiRef.current.setValue('models', nextModels);
          }
          showSuccess(t('模型列表已追加更新'));
        }}
      />
    </>
  );
};

export default EditChannelModal;
