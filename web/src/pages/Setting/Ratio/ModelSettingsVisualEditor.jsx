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
import ModelPricingEditor from './components/ModelPricingEditor';
import { API } from '../../../helpers';

export default function ModelSettingsVisualEditor(props) {
  const [channelModels, setChannelModels] = useState([]);

  useEffect(() => {
    API.get('/api/channel/models_enabled')
      .then((res) => {
        const { success, data } = res.data;
        if (success) {
          setChannelModels(data || []);
        }
      })
      .catch(() => {
        setChannelModels([]);
      });
  }, []);

  return (
    <ModelPricingEditor
      options={props.options}
      refresh={props.refresh}
      candidateModelNames={channelModels}
    />
  );
}
