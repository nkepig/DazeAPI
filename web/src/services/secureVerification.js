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

import { API } from '../helpers';

/**
 * 通用安全验证服务（2FA / Passkey 后端已移除时：无可用验证方式）
 */
export class SecureVerificationService {
  /**
   * @returns {Promise<{has2FA: boolean, hasPasskey: boolean, passkeySupported: boolean}>}
   */
  static async checkAvailableVerificationMethods() {
    return {
      has2FA: false,
      hasPasskey: false,
      passkeySupported: false,
    };
  }

  static async verify2FA() {
    throw new Error('两步验证功能已关闭');
  }

  static async verifyPasskey() {
    throw new Error('Passkey 功能已关闭');
  }

  static async verify(method, _code = '') {
    switch (method) {
      case '2fa':
        return this.verify2FA();
      case 'passkey':
        return this.verifyPasskey();
      default:
        throw new Error(`不支持的验证方式: ${method}`);
    }
  }
}

/**
 * 预设的API调用函数工厂
 */
export const createApiCalls = {
  viewChannelKey: (channelId) => async () => {
    const response = await API.post(`/api/channel/${channelId}/key`, {});
    return response.data;
  },

  custom:
    (url, method = 'POST', extraData = {}) =>
    async () => {
      const data = extraData;
      let response;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await API.get(url, { params: data });
          break;
        case 'POST':
          response = await API.post(url, data);
          break;
        case 'PUT':
          response = await API.put(url, data);
          break;
        case 'DELETE':
          response = await API.delete(url, { data });
          break;
        default:
          throw new Error(`不支持的HTTP方法: ${method}`);
      }
      return response.data;
    },
};
