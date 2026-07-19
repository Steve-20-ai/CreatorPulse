# 数据字典

`data/creators.csv` 中的全部达人记录均为合成数据。字段结构模拟生产系统需要的数据契约，但不对应任何真实个人或账号。

## 达人字段

| 字段 | 类型 | 示例 | 说明 |
|---|---|---|---|
| `creator_id` | string | `CR001` | 内部匿名标识 |
| `handle` | string | `@lena_nightride_demo` | 合成账号名，统一带 `_demo` |
| `display_name` | string | `Lena Night Ride` | 展示名称 |
| `platform` | enum | `YouTube` | 演示平台 |
| `country` | ISO code | `DE` | 达人所在国家 |
| `language` | ISO code | `de` | 主要内容语言 |
| `audience_primary_market` | ISO code | `DE` | 受众第一市场 |
| `audience_market_share` | 0–1 | `0.62` | 第一市场受众占比 |
| `primary_scenario` | slug | `night-cycling` | 主要运动/内容场景 |
| `secondary_scenarios` | list | `urban-cycling|technology` | `|` 分隔的次要场景 |
| `content_style` | slug | `technical-first-person` | 内容表达风格 |
| `follower_count` | integer | `184000` | 粉丝量，仅作背景特征 |
| `avg_views` | integer | `128000` | 平均播放量 |
| `engagement_rate` | 0–1 | `0.087` | 合成互动率 |
| `completion_rate` | 0–1 | `0.64` | 合成完播率 |
| `click_rate` | 0–1 | `0.055` | 合成点击率 |
| `conversion_rate` | 0–1 | `0.024` | 合成转化率 |
| `rate_usd` | number | `1450` | 单次合作报价（美元） |
| `delivery_reliability` | 0–1 | `0.94` | 合成交付稳定性 |
| `brand_safety` | 0–1 | `0.97` | 合成品牌安全评分 |
| `content_quality` | 0–1 | `0.91` | 合成内容质量评分 |
| `evidence_summary` | string | — | 人工可读的演示证据摘要 |
| `is_synthetic` | boolean | `true` | 数据来源标志 |

## 产品字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `product_id` | string | 产品内部标识 |
| `name` | string | 官方产品名称 |
| `brand` | string | 页面中独立展示的品牌名 |
| `model` | string | 页面中独立展示的产品型号 |
| `category` | string | 产品类别 |
| `scenarios` | string[] | MVP 演示场景标签 |
| `goals` | string[] | 支持的营销目标 |
| `markets` | string[] | 演示市场 |
| `key_message` | string | 演示用内容方向，不代表官方完整规格 |
| `asset` | path | 本地官方产品素材路径 |
| `asset_type` | enum | `cutout` 为独立产品图，`scene` 为场景图 |
| `asset_position` | CSS position | 场景图响应式裁切的视觉焦点 |
| `source_note` | string | 来源与边界说明 |

## 数据质量策略

- 缺失字段不会被填入虚构值，而是降低推荐置信度。
- 合成数据的置信度上限低于生产授权数据。
- 生产环境中的个人数据需满足目的限定、最小必要、留存期限和访问审计要求。
