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

import React from 'react';

export const ModalTitle = ({ title, subtitle }) => (
  <div className='modal-title-block'>
    <div className='modal-title-block-main'>{title}</div>
    {subtitle ? (
      <div className='modal-title-block-sub'>{subtitle}</div>
    ) : null}
  </div>
);

const FormSection = ({ title, desc, children, className = '' }) => (
  <section className={`form-section ${className}`.trim()}>
    {(title || desc) && (
      <header className='form-section-head'>
        {title ? <div className='form-section-title'>{title}</div> : null}
        {desc ? <p className='form-section-desc'>{desc}</p> : null}
      </header>
    )}
    {children}
  </section>
);

export default FormSection;
