# 木门加工企业库存与订单管理系统

> 内网 demo · Node.js 全栈 · 不商用
> 技术栈：Express + mysql2 + MySQL / Vue3 + Element-Plus

## 项目结构

```
wood-apple-store-management/
├── server/                 后端（Express + mysql2）
│   ├── src/
│   │   ├── db/             数据库连接池 + 表结构参考(schema)
│   │   ├── routes/         7大业务模块路由
│   │   ├── services/       采购建议算法（BOM拆解，核心）
│   │   ├── middlewares/    JWT鉴权 + 角色权限
│   │   ├── utils/          响应封装 + 单据号生成 + JWT
│   │   ├── app.js / server.js
│   │   └── .env            数据库配置（不入库）
│   └── test/smoke.js       端到端冒烟测试
├── web/                    前端（Vue3 + Vite + Element-Plus）
│   └── src/
│       ├── api/            接口封装
│       ├── views/          10个业务页面
│       ├── layout/         侧边栏布局
│       ├── router/         路由 + 角色菜单
│       └── store/          Pinia 用户状态
├── migration/              迁移部署脚本（小白可用）
│   ├── README-迁移说明.md
│   ├── 导出数据.bat / 导入数据.bat / 一键迁移.bat
│   └── export.js / import.js / create-db.js
└── README.md
```

## 功能模块

1. **物料档案** — 7种物料（面板/大板/线条/封边条/杉木木板/实木门芯/石墨烯填充），CRUD
2. **门型BOM配方** — 门型+物料明细（单位用量/损耗系数/可选颜色）
3. **销售订单** — 接单→发货回填→收款回填，状态自动流转
4. **采购入库** — 到货确认后库存自动增加
5. **生产领料** — 库存自动减少，含库存不足校验
6. **库存查询** — 实时库存+状态判断（充足/不足/严重缺货）
7. **采购建议**（核心）— 接单时按BOM拆解算缺口，自动生成采购建议
8. **报表** — 库存总表 + 订单全流程跟踪表

## 角色

| 账号 | 密码 | 角色 | 可见菜单 |
|---|---|---|---|
| sale | 123456 | 销售 | 订单、库存查询、订单跟踪表 |
| stock | 123456 | 库管/采购 | 全部业务模块 |
| finance | 123456 | 财务/老板 | 全部（含收款、报表） |

## 快速开始

详见 `migration/README-迁移说明.md`。简要：

```bash
# 后端
cd server && npm install
cp .env.example .env   # 改 DB_PASSWORD 为你的 MySQL 密码
mysql -u root -p < server/src/db/wood_store_data.sql   # 建表+数据一次导入
npm start              # http://127.0.0.1:3001

# 前端
cd web && npm install
npm run dev            # http://127.0.0.1:55080
```

## 核心算法：采购建议（BOM 拆解）

接单保存时触发：
```
物料需求总量 = 订单数量 × BOM单位用量 × (1 + 损耗系数/100)
可用库存 = 当前库存 - 安全库存
库存缺口 = 物料需求总量 - 可用库存
若缺口 > 0 → 生成采购建议（紧急/常规按约定发货日期判断）
```

## 数据备份

`migration/导出数据.bat` 生成 `wood_store_backup.sql`；`导入数据.bat` 恢复。
