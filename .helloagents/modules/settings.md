# settings 模块

## 职责
- 维护系统级配置（如日志保留天数）
- 为使用日志与面板提供统一配置读取
- 维护定时签到执行时间
- 维护模型失败冷却时间（运行时失败的渠道/模型冷却窗口）

## 接口定义
- `GET /api/settings` 读取设置
- `PUT /api/settings` 更新设置

## 行为规范
- 配置写入后即时生效
- 未配置时使用环境变量默认值
- 定时签到时间使用 `HH:mm` 格式（默认 `00:10`，中国时间）
- 更新签到时间后会触发 `CheckinScheduler` 重新调度
- 若更新后当前时间已超过新签到时间，当日可再次触发自动签到
- 模型失败冷却以分钟计（默认 10 分钟），用于跳过最近失败的渠道/模型
- 代理 CPU 降载相关开关使用环境变量（非 DB 设置）
- `GET /api/settings` 额外返回 `runtime_config`（环境变量读取结果），用于展示流式 usage 解析与队列状态
- 运行时配置中 `PROXY_STREAM_USAGE_MAX_BYTES/PROXY_STREAM_USAGE_MAX_PARSERS` 设为 `0` 表示无限制

## 依赖关系
- `settings` 表
