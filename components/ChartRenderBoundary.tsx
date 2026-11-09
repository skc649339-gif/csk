'use client';
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; onReturn: () => void; onExport: () => void; canExport: boolean }
/** A last-resort render guard; recovery actions never delete or rewrite stored records. */
export default class ChartRenderBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="app-notice error" role="alert">
      <h2>这份命盘暂时无法显示</h2>
      <p>已保存的本地数据保持原样。可导出原始数据，再返回记录列表查看其他命盘。</p>
      <div className="app-toolbar">
        {this.props.canExport && <button type="button" className="app-button quiet" onClick={this.props.onExport}>导出原始数据</button>}
        <button type="button" className="app-button quiet" onClick={this.props.onReturn}>返回记录列表</button>
      </div>
    </section>;
  }
}
