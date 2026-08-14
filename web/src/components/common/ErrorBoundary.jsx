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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className='flex flex-col items-center justify-center min-h-[40vh] gap-3 px-6 text-center'>
          <div className='text-base font-medium text-[#1a1a1a]'>页面出了点问题</div>
          <div className='text-sm text-[#888]'>可以刷新重试，导航栏仍可使用</div>
          <button
            type='button'
            className='mt-2 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white'
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
