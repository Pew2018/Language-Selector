# WebUI 状态与验收说明（0.1.3）
本轮仅修改展示层、前端状态映射和回归验证；不修改 schema=1、control.sh、security.sh、boot-completed.sh 或桥接执行策略。
模块名称保持 Language Selector；应用语言 / 设置为两个一级入口。

## 由代码确认的含义
- control locale 先建立 journal，再修改 Android 设置、严格读回核对并保存配置，成功后删除 journal。前端不提前把目标当作当前设置。
- pending 表示需要核对的中断/未确认操作，不是队列。核对只读取当前设置并保存结果，不重放语言修改；入口继续使用确认。
- 列表按模块专属语言配置置顶，数量只统计当前过滤可见项。跟随系统的保存项沿用已有非置顶规则。
- 当前跟随系统只来自空 Android 应用语言列表；不比较设备默认语言推断。
- 已生效只表示 Android 设置与保存目标核对一致，不能检测应用实际 UI。实际显示取决于应用支持及是否重启。
- 未核对、正在核对、不一致、读取失败均不显示成功勾。详情分别显示当前与配置；代码只在名称不等于代码时显示次文本。
- 开机状态日志是历史记录。Android 用户变化映射为停止/中断，不将 failed=0 假设为成功，不提供缺乏后端支持的重试。

## 展示与交互
名称和图标两开关保持独立，关闭名称仍只搜索包名；关闭对应读取，不增加名称解析。
列表使用整体确定/不确定进度，允许搜索和浏览；写入控件保留配置/恢复/执行中保护。
搜索聚焦压缩应用摘要；视觉视口缩小后恢复时可退出紧凑模式。搜索值及焦点不会因结果刷新重置。
恢复跟随系统为可逆直接操作，不弹新增确认；语言应用保留已有确认。日志复制只读取已展示的日志，不调用 Root 或采集额外数据。
列表/语言行不生成涟漪节点。小控件用 pointercancel、位移/滚动阈值取消反馈；只保留一个涟漪节点且超时清理。

## 验证范围
GitHub Actions 执行状态模型、安全/配置、BusyBox ash、mksh 与 Playwright 回归，产生浅/深色、四显示模式、历史日志、搜索缩短视口及大字体预览。
缩短浏览器视口只能验证布局逻辑，不能等同 Android 系统键盘。未连接真机，不能宣称验证 KernelSU Next 原生接口、真实应用语言生效或 WebView dp/系统栏。

## 真机复核
在 Pixel / KernelSU Next 中检查键盘弹出、返回关闭键盘、结果滚动及清除焦点；较大系统字体/显示缩放；Insets 与手势条；原生回退与复制权限；
验证当前语言/配置目标的匹配和不一致、真实失败后的核对；恢复按钮的禁用状态；长列表滚动不误触。
参考 [Material 2 Text fields](https://m2.material.io/design/components/text-fields.html)、[Lists](https://m2.material.io/components/lists/web)、[Progress](https://m2.material.io/components/progress-indicators)、[Snackbars](https://m2.material.io/design/components/snackbars.html)、[Touch targets](https://m2.material.io/design/layout/spacing-methods.html)。
