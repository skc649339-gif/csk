# CSK 部署安全整改与迁移方案

本文件描述第四阶段本地配置。**它没有改变当前 GitHub 或线上环境，也不是发布授权。**

## 本地目标配置

- `.github/workflows/ci.yml`：普通 push、PR 和手动检查只执行安装、类型、上游/本地/引擎/PWA 回归、构建与高风险依赖审计。Token 只有 contents:read；没有 Pages action、生产环境、pages/id-token 写权限。
- `.github/workflows/deploy-pages.yml`：只有 workflow_dispatch，且固定仓库 `skc649339-gif/csk`、分支 `feature/iphone-pwa`。必须输入 `PUBLISH_CSK` 和经过独立审核的完整 40 位 SHA。校验脚本还将其与运行 SHA、checkout SHA 比较，缺失或不一致即失败。
- 手动 build 同样执行全部检查，不复用其他运行中来源不明的制品。只有 `needs: build` 成功后才进入 deploy；pages:write / id-token:write 只在该 job 授予。
- 现有 `/csk/`、Manifest、SW 路径及命盘/主题存储键不变。环境名称仍是 github-pages，不声称已经新增审批人或保护规则。

输入确认只是显式操作门槛，不能替代 GitHub 账号权限、独立审核或用户授权。具有写权限的维护者仍可以修改工作流本身。

## 迁移前现状

本轮开始的默认分支是 feature/iphone-pwa；远端仍为 587a084，本地原仓库为 c964193。远端旧工作流在该功能分支普通推送后会自动发布。**不得先直接 push 当前功能分支，再尝试补安全措施。**

下列步骤均属于待申请的远端操作；本轮未执行。

## 推荐迁移顺序

1. **申请仅暂停旧发布工作流的授权。** 明确对象为 `skc649339-gif/csk` 中原 Pages 工作流（此前 ID 411829214，执行时须重新核实 ID/状态）。暂停可逆，当前已发布网站保持原版本，但后续自动发布会停止。
2. 只读检查 queued / in_progress 运行。暂停不会取消已有运行；如需取消，必须将具体运行 ID 和取消影响另列并取得授权，不得假定暂停即可阻止旧队列。
3. 经用户明确授权后，在独立审查分支交付完整补丁，运行仅检查的 CI，审查 R3-01/R3-02、门禁、制品和完整 SHA。不要直接把未审核内容推到旧功能分支。
4. 经单独授权，将通过审查的版本受控纳入默认功能分支；保持旧发布工作流暂停。重新读取远端 YAML，确认只有 workflow_dispatch、无 push/PR/workflow_run 发布入口，普通 CI 无生产权限。
5. 准备独立验收结论、完整已提交 SHA、已知风险和必要的 iPhone 合成数据清单。申请**重新启用手动发布机制**的授权；启用不等于执行发布。若采用 GitHub required_reviewers 等生产环境规则，也需单独说明并授权修改。
6. **首次生产 workflow_dispatch 必须再次单独授权。** 明确这会覆盖 `https://skc649339-gif.github.io/csk/`。输入经审查的 SHA 和确认词，检查全部通过后才可部署；不能把“允许检查/推送审查分支”解释成发布授权。
7. 部署后按实际运行 SHA 和制品哈希重新核验线上资源，然后由用户进行真实 iPhone 验收。不要上传真实命盘；异常备份测试使用隔离来源和合成记录。

可选方案是在明确授权的独立审查分支先提交与检查；因旧发布仅绑定功能分支，该审查分支本身不应发布。但是合入默认功能分支前仍需处理旧运行和迁移门槛，不能省略核对。

## 中止与恢复

如当前 SHA、工作流状态、分支规则或待运行队列与审查记录不一致，停止外部操作并重新核对。若迁移检查不通过，保留当前线上可运行版本，维持暂停，不自动重新启用旧的 push 发布。回退应用也需新授权，不涉及清空用户存储；任何文件回退都不能恢复或覆盖个人命盘数据。

## 关闭证据边界

本地 YAML AST、发布门禁、普通 push 不具备发布权限的测试可以在本轮完成；**远端自动发布风险只有在授权迁移后、实际远端配置核验通过时才算现网关闭**。本地测试成功不能标成远端整改已生效。

依据：[GitHub 手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)、[暂停/启用工作流（不取消已有运行）](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)、[环境部署保护规则](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)。
