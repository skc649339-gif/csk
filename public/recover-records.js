'use strict';

for (const button of document.querySelectorAll('button[data-version]')) {
  button.addEventListener('click', () => {
    const status = document.getElementById('result');
    const version = button.dataset.version;
    try {
      const raw = localStorage.getItem('ziwei-personal-records-v' + version);
      if (raw === null) {
        status.textContent = '当前存储中没有这一版本的命盘数据。';
        return;
      }
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `csk-records-v${version}-raw.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      status.textContent = '已生成原始备份，请保存到“文件”。';
    } catch {
      status.textContent = '无法读取或导出。请在存有命盘的浏览器或主屏幕 App 中打开本页。';
    }
  });
}
