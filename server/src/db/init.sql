-- 木门加工企业库存与订单管理系统 - 数据库初始化脚本
-- 数据库: wood_store
-- 字符集: utf8mb4

CREATE DATABASE IF NOT EXISTS wood_store DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wood_store;

-- ============================================================
-- 1. 用户表
-- ============================================================
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE COMMENT '登录账号',
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 哈希',
  role          ENUM('sale','stock','finance') NOT NULL COMMENT '销售/库管/财务',
  name          VARCHAR(50)  NOT NULL COMMENT '姓名',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================================
-- 2. 物料档案表
-- ============================================================
DROP TABLE IF EXISTS materials;
CREATE TABLE materials (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL UNIQUE COMMENT '物料编码 CL-001',
  name          VARCHAR(50)  NOT NULL COMMENT '物料名称',
  category      ENUM('主材','耗材') NOT NULL COMMENT '主材/耗材',
  spec          VARCHAR(100) NOT NULL COMMENT '规格型号',
  unit          VARCHAR(20)  NOT NULL COMMENT '计量单位',
  stock_qty     DECIMAL(14,3) NOT NULL DEFAULT 0 COMMENT '当前库存数量(缓存,由流水维护)',
  safety_stock  DECIMAL(14,3) NOT NULL DEFAULT 0 COMMENT '最低安全库存',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料档案';

-- ============================================================
-- 3. 门型BOM配方主表
-- ============================================================
DROP TABLE IF EXISTS door_bom;
CREATE TABLE door_bom (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL UNIQUE COMMENT '门型编号 M-101',
  name          VARCHAR(50)  NOT NULL COMMENT '门型名称',
  standard_size VARCHAR(100) NOT NULL COMMENT '标准尺寸 高x宽x厚',
  colors        VARCHAR(255) NOT NULL COMMENT '可选颜色,逗号分隔',
  nonstd_markup DECIMAL(5,2) DEFAULT 0 COMMENT '非标加价比例%',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门型BOM配方';

-- ============================================================
-- 4. BOM 明细表
-- ============================================================
DROP TABLE IF EXISTS door_bom_items;
CREATE TABLE door_bom_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  bom_id       INT NOT NULL COMMENT '门型BOM id',
  material_id  INT NOT NULL COMMENT '物料id',
  unit_usage   DECIMAL(14,3) NOT NULL COMMENT '每樘门消耗量',
  loss_rate    DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '损耗系数%',
  CONSTRAINT fk_bomitem_bom      FOREIGN KEY (bom_id) REFERENCES door_bom(id) ON DELETE CASCADE,
  CONSTRAINT fk_bomitem_material FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='BOM明细';

-- ============================================================
-- 5. 销售订单表
-- ============================================================
DROP TABLE IF EXISTS sales_orders;
CREATE TABLE sales_orders (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  order_no           VARCHAR(30)  NOT NULL UNIQUE COMMENT 'SO-YYYYMMDD-NNN',
  customer           VARCHAR(100) NOT NULL COMMENT '客户名称/项目地址',
  door_bom_id        INT          NOT NULL COMMENT '门型',
  color              VARCHAR(50)  NOT NULL COMMENT '颜色',
  qty                INT          NOT NULL COMMENT '订单数量(樘)',
  unit_price         DECIMAL(12,2) NOT NULL COMMENT '销售单价',
  total_amount       DECIMAL(14,2) NOT NULL COMMENT '订单总金额',
  handler_sale       VARCHAR(50)  NOT NULL COMMENT '经手人(销售)',
  order_date         DATE         NOT NULL COMMENT '下单日期',
  expected_ship_date DATE         NULL COMMENT '约定发货日期',
  actual_ship_date   DATE         NULL COMMENT '实际发货日期',
  ship_no            VARCHAR(50)  NULL COMMENT '发货单号',
  handler_ship       VARCHAR(50)  NULL COMMENT '发货经手人',
  pay_date           DATE         NULL COMMENT '收款日期',
  receipt_no         VARCHAR(50)  NULL COMMENT '收据单号',
  handler_finance    VARCHAR(50)  NULL COMMENT '收款经手人',
  status             ENUM('新建','已发货','已收款') NOT NULL DEFAULT '新建',
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_bom FOREIGN KEY (door_bom_id) REFERENCES door_bom(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售订单';

-- ============================================================
-- 6. 采购入库单表
-- ============================================================
DROP TABLE IF EXISTS purchase_inbound;
CREATE TABLE purchase_inbound (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  inbound_no        VARCHAR(30)   NOT NULL UNIQUE COMMENT 'RK-YYYYMMDD-NNN',
  material_id       INT           NOT NULL,
  supplier          VARCHAR(100)  NOT NULL COMMENT '进货厂家',
  qty               DECIMAL(14,3) NOT NULL COMMENT '进货数量',
  unit_price        DECIMAL(12,2) NOT NULL COMMENT '进货单价',
  freight           DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '本次物流费用',
  purchase_date     DATE          NOT NULL COMMENT '进货日期',
  expected_arrival  DATE          NULL COMMENT '预计到货日期',
  actual_arrival    DATE          NULL COMMENT '实际到货日期(填后入库生效)',
  handler           VARCHAR(50)   NOT NULL COMMENT '经手人',
  status            ENUM('待到货','已到货') NOT NULL DEFAULT '待到货',
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inbound_material FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购入库单';

-- ============================================================
-- 7. 生产领料单表
-- ============================================================
DROP TABLE IF EXISTS material_requisition;
CREATE TABLE material_requisition (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  req_no     VARCHAR(30)   NOT NULL UNIQUE COMMENT 'LL-YYYYMMDD-NNN',
  order_id   INT           NOT NULL COMMENT '关联销售订单',
  material_id INT          NOT NULL,
  qty        DECIMAL(14,3) NOT NULL COMMENT '领用数量',
  req_date   DATE          NOT NULL COMMENT '领用日期',
  handler    VARCHAR(50)   NOT NULL COMMENT '经手人',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_req_order    FOREIGN KEY (order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_req_material FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='生产领料单';

-- ============================================================
-- 8. 库存变动流水表
-- ============================================================
DROP TABLE IF EXISTS inventory_log;
CREATE TABLE inventory_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT           NOT NULL,
  change_type ENUM('in','out') NOT NULL COMMENT '入库/出库',
  qty         DECIMAL(14,3) NOT NULL COMMENT '变动数量(正数)',
  ref_no      VARCHAR(30)   NOT NULL COMMENT '关联单据号',
  operator    VARCHAR(50)   NOT NULL COMMENT '操作人',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_material FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存变动流水';

-- ============================================================
-- 9. 采购建议表
-- ============================================================
DROP TABLE IF EXISTS purchase_suggestion;
CREATE TABLE purchase_suggestion (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT           NOT NULL,
  suggest_qty DECIMAL(14,3) NOT NULL COMMENT '建议采购数量',
  order_id    INT           NOT NULL COMMENT '关联订单',
  priority    ENUM('紧急','常规') NOT NULL DEFAULT '常规',
  status      ENUM('待采购','已采购') NOT NULL DEFAULT '待采购',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sug_material FOREIGN KEY (material_id) REFERENCES materials(id),
  CONSTRAINT fk_sug_order    FOREIGN KEY (order_id) REFERENCES sales_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购建议';
