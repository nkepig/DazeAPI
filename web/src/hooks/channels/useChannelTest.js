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

import { useState, useRef } from 'react';
import { API, showError, showInfo, showSuccess, copy, toBoolean } from '../../helpers';
import { Modal, Button } from '@douyinfe/semi-ui';
import { openCodexUsageModal } from '../../components/table/channels/modals/CodexUsageModal';

export const useChannelTest = ({ t, channels, updateChannelProperty, refresh }) => {
  const [showModelTestModal, setShowModelTestModal] = useState(false);
  const [currentTestChannel, setCurrentTestChannel] = useState(null);
  const [modelSearchKeyword, setModelSearchKeyword] = useState('');
  const [modelTestResults, setModelTestResults] = useState({});
  const [testingModels, setTestingModels] = useState(new Set());
  const [selectedModelKeys, setSelectedModelKeys] = useState([]);
  const [isBatchTesting, setIsBatchTesting] = useState(false);
  const [modelTablePage, setModelTablePage] = useState(1);
  const [selectedEndpointType, setSelectedEndpointType] = useState('');
  const [isStreamTest, setIsStreamTest] = useState(false);
  const [globalPassThroughEnabled, setGlobalPassThroughEnabled] = useState(false);
  const [showMultiKeyManageModal, setShowMultiKeyManageModal] = useState(false);
  const [currentMultiKeyChannel, setCurrentMultiKeyChannel] = useState(null);

  const shouldStopBatchTestingRef = useRef(false);

  const fetchGlobalPassThroughEnabled = async () => {
    try {
      const res = await API.get('/api/option/');
      const { success, data } = res?.data || {};
      if (!success || !Array.isArray(data)) {
        return;
      }
      const option = data.find(
        (item) => item?.key === 'global.pass_through_request_enabled',
      );
      if (option) {
        setGlobalPassThroughEnabled(toBoolean(option.value));
      }
    } catch (error) {
      setGlobalPassThroughEnabled(false);
    }
  };

  const testChannel = async (
    record,
    model,
    endpointType = '',
    stream = false,
    keyIndex = undefined,
  ) => {
    const testKey = `${record.id}-${model}${keyIndex !== undefined ? `-k${keyIndex}` : ''}`;

    if (shouldStopBatchTestingRef.current && isBatchTesting) {
      return Promise.resolve();
    }

    setTestingModels((prev) => new Set([...prev, model]));

    try {
      let res;
      if (keyIndex !== undefined) {
        res = await API.post('/api/channel/multi_key/manage', {
          channel_id: record.id,
          action: 'test_key',
          key_index: keyIndex,
          test_model: model,
        });
        const { success, message, headers, body, status_code } = res.data;
        setModelTestResults((prev) => ({
          ...prev,
          [testKey]: {
            success,
            message,
            time: 0,
            timestamp: Date.now(),
            headers,
            body,
            statusCode: status_code ?? null,
          },
        }));
        if (success) {
          showInfo(
            t('密钥 #${index} 测试成功，模型 ${model}')
              .replace('${index}', keyIndex)
              .replace('${model}', model),
          );
        } else {
          showError(`${t('模型')} ${model}: ${message}`);
        }
      } else {
        let url = `/api/channel/test/${record.id}?model=${model}`;
        if (endpointType) {
          url += `&endpoint_type=${endpointType}`;
        }
        if (stream) {
          url += `&stream=true`;
        }
        res = await API.get(url);

        if (shouldStopBatchTestingRef.current && isBatchTesting) {
          return Promise.resolve();
        }

        const { success, message, time, headers, body, status_code } = res.data;

        setModelTestResults((prev) => ({
          ...prev,
          [testKey]: {
            success,
            message,
            time: time || 0,
            timestamp: Date.now(),
            headers,
            body,
            statusCode: status_code ?? null,
          },
        }));

        if (success) {
          updateChannelProperty(record.id, (channel) => {
            channel.response_time = time * 1000;
            channel.test_time = Date.now() / 1000;
          });

          if (!model || model === '') {
            showInfo(
              t('通道 ${name} 测试成功，耗时 ${time.toFixed(2)} 秒。')
                .replace('${name}', record.name)
                .replace('${time.toFixed(2)}', time.toFixed(2)),
            );
          } else {
            showInfo(
              t(
                '通道 ${name} 测试成功，模型 ${model} 耗时 ${time.toFixed(2)} 秒。',
              )
                .replace('${name}', record.name)
                .replace('${model}', model)
                .replace('${time.toFixed(2)}', time.toFixed(2)),
            );
          }
        } else {
          showError(`${t('模型')} ${model}: ${message}`);
        }
      }
    } catch (error) {
      const errKey = `${record.id}-${model}`;
      setModelTestResults((prev) => ({
        ...prev,
        [errKey]: {
          success: false,
          message: error.message || t('网络错误'),
          time: 0,
          timestamp: Date.now(),
        },
      }));
      showError(`${t('模型')} ${model}: ${error.message || t('测试失败')}`);
    } finally {
      setTestingModels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(model);
        return newSet;
      });
    }
  };

  const batchTestModels = async () => {
    if (!currentTestChannel || !currentTestChannel.models) {
      showError(t('渠道模型信息不完整'));
      return;
    }

    const models = currentTestChannel.models
      .split(',')
      .filter((model) =>
        model.toLowerCase().includes(modelSearchKeyword.toLowerCase()),
      );

    if (models.length === 0) {
      showError(t('没有找到匹配的模型'));
      return;
    }

    setIsBatchTesting(true);
    shouldStopBatchTestingRef.current = false;

    setModelTestResults((prev) => {
      const newResults = { ...prev };
      models.forEach((model) => {
        const testKey = `${currentTestChannel.id}-${model}`;
        delete newResults[testKey];
      });
      return newResults;
    });

    try {
      showInfo(
        t('开始批量测试 ${count} 个模型，已清空上次结果...').replace(
          '${count}',
          models.length,
        ),
      );

      const concurrencyLimit = 5;
      const results = [];

      for (let i = 0; i < models.length; i += concurrencyLimit) {
        if (shouldStopBatchTestingRef.current) {
          showInfo(t('批量测试已停止'));
          break;
        }

        const batch = models.slice(i, i + concurrencyLimit);
        showInfo(
          t('正在测试第 ${current} - ${end} 个模型 (共 ${total} 个)')
            .replace('${current}', i + 1)
            .replace('${end}', Math.min(i + concurrencyLimit, models.length))
            .replace('${total}', models.length),
        );

        const batchPromises = batch.map((model) =>
          testChannel(
            currentTestChannel,
            model,
            selectedEndpointType,
            isStreamTest,
            currentTestChannel?._testKeyIndex,
          ),
        );
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        if (shouldStopBatchTestingRef.current) {
          showInfo(t('批量测试已停止'));
          break;
        }

        if (i + concurrencyLimit < models.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (!shouldStopBatchTestingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 300));

        setModelTestResults((currentResults) => {
          let successCount = 0;
          let failCount = 0;

          models.forEach((model) => {
            const testKey = `${currentTestChannel.id}-${model}`;
            const result = currentResults[testKey];
            if (result && result.success) {
              successCount++;
            } else {
              failCount++;
            }
          });

          setTimeout(() => {
            showSuccess(
              t('批量测试完成！成功: ${success}, 失败: ${fail}, 总计: ${total}')
                .replace('${success}', successCount)
                .replace('${fail}', failCount)
                .replace('${total}', models.length),
            );
          }, 100);

          return currentResults;
        });
      }
    } catch (error) {
      showError(t('批量测试过程中发生错误: ') + error.message);
    } finally {
      setIsBatchTesting(false);
    }
  };

  const stopBatchTesting = () => {
    shouldStopBatchTestingRef.current = true;
    setIsBatchTesting(false);
    setTestingModels(new Set());
    showInfo(t('已停止批量测试'));
  };

  const clearTestResults = () => {
    setModelTestResults({});
    showInfo(t('已清空测试结果'));
  };

  const handleCloseModal = () => {
    if (isBatchTesting) {
      shouldStopBatchTestingRef.current = true;
      showInfo(t('关闭弹窗，已停止批量测试'));
    }

    setShowModelTestModal(false);
    setModelSearchKeyword('');
    setIsBatchTesting(false);
    setTestingModels(new Set());
    setSelectedModelKeys([]);
    setModelTablePage(1);
    setSelectedEndpointType('');
    setIsStreamTest(false);
  };

  const testAllChannels = async () => {
    const res = await API.get(`/api/channel/test`);
    const { success, message } = res.data;
    if (success) {
      showInfo(t('已成功开始测试所有已启用通道，请刷新页面查看结果。'));
    } else {
      showError(message);
    }
  };

  const updateChannelBalance = async (record) => {
    if (record?.type === 57) {
      openCodexUsageModal({
        t,
        record,
        onCopy: async (text) => {
          const ok = await copy(text);
          if (ok) showSuccess(t('已复制'));
          else showError(t('复制失败'));
        },
      });
      return;
    }

    const res = await API.get(`/api/channel/update_balance/${record.id}/`);
    const { success, message, balance } = res.data;
    if (success) {
      updateChannelProperty(record.id, (channel) => {
        channel.balance = balance;
        channel.balance_updated_time = Date.now() / 1000;
      });
      showInfo(
        t('通道 ${name} 余额更新成功！').replace('${name}', record.name),
      );
    } else {
      showError(message);
    }
  };

  const checkOllamaVersion = async (record) => {
    try {
      const res = await API.get(`/api/channel/ollama/version/${record.id}`);
      const { success, message, data } = res.data;

      if (success) {
        const version = data?.version || '-';
        const infoMessage = t('当前 Ollama 版本为 ${version}').replace(
          '${version}',
          version,
        );

        const handleCopyVersion = async () => {
          if (!version || version === '-') {
            showInfo(t('暂无可复制的版本信息'));
            return;
          }

          const copied = await copy(version);
          if (copied) {
            showSuccess(t('已复制版本号'));
          } else {
            showError(t('复制失败，请手动复制'));
          }
        };

        Modal.info({
          title: t('Ollama 版本信息'),
          content: infoMessage,
          centered: true,
          footer: (
            <div className='flex justify-end gap-2'>
              <Button type='tertiary' onClick={handleCopyVersion}>
                {t('复制版本号')}
              </Button>
              <Button
                type='primary'
                theme='solid'
                onClick={() => Modal.destroyAll()}
              >
                {t('关闭')}
              </Button>
            </div>
          ),
          hasCancel: false,
          hasOk: false,
          closable: true,
          maskClosable: true,
        });
      } else {
        showError(message || t('获取 Ollama 版本失败'));
      }
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.message ||
        t('获取 Ollama 版本失败');
      showError(errMsg);
    }
  };

  return {
    showModelTestModal,
    setShowModelTestModal,
    currentTestChannel,
    setCurrentTestChannel,
    modelSearchKeyword,
    setModelSearchKeyword,
    modelTestResults,
    testingModels,
    selectedModelKeys,
    setSelectedModelKeys,
    isBatchTesting,
    modelTablePage,
    setModelTablePage,
    selectedEndpointType,
    setSelectedEndpointType,
    isStreamTest,
    setIsStreamTest,
    showMultiKeyManageModal,
    setShowMultiKeyManageModal,
    currentMultiKeyChannel,
    setCurrentMultiKeyChannel,
    globalPassThroughEnabled,
    fetchGlobalPassThroughEnabled,
    testChannel,
    batchTestModels,
    stopBatchTesting,
    clearTestResults,
    handleCloseModal,
    testAllChannels,
    updateChannelBalance,
    checkOllamaVersion,
    shouldStopBatchTestingRef,
  };
};