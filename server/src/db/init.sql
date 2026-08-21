-- 木门加工企业库存与订单管理系统 - 数据库表结构（schema 参考）
-- 数据库: wood_store
-- 字符集: utf8mb4
-- 说明: 本文件为表结构参考，供开发/AI 查看字段定义；生产数据通过 .sql 导入恢复，
--       请勿用此文件初始化生产库（用 CREATE TABLE IF NOT EXISTS，重复执行不破坏数据）。

CREATE DATABASE IF NOT EXISTS wood_store DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wood_store;

-- ============================================================
-- 1. 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE COMMENT '登录账号',
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 哈希',
  role          ENUM('boss','worker') NOT NULL COMMENT '老板(超管)/工人(仅量尺)',
  name          VARCHAR(50)  NOT NULL COMMENT '姓名',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================================
-- 2. 物料档案表
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL UNIQUE COMMENT '物料编码 CL-001',
  name          VARCHAR(50)  NOT NULL COMMENT '物料名称',
  category      ENUM('主材','耗材') NOT NULL COMMENT '主材/耗材',
  spec          VARCHAR(100) NOT NULL COMMENT '规格型号',
  unit          VARCHAR(20)  NOT NULL COMMENT '计量单位',
  stock_qty     DECIMAL(14,3) NOT NULL DEFAULT 0 COMMENT '当前库存数量(缓存,由流水维护)',
  safety_stock  DECIMAL(14,3) NOT NULL DEFAULT 0 COMMENT '最低安全库存',
  origin_place  VARCHAR(100) NULL COMMENT '生产地(如江西赣州)',
  manufacturer  VARCHAR(100) NULL COMMENT '厂家名',
  unit_price    DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '物料参考单价(非必填,默认0;领料成本计算用)',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料档案';

-- ============================================================
-- 3. 门型BOM配方主表
-- ============================================================
CREATE TABLE IF NOT EXISTS door_bom (
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
CREATE TABLE IF NOT EXISTS door_bom_items (
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
CREATE TABLE IF NOT EXISTS sales_orders (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  order_no           VARCHAR(30)  NOT NULL UNIQUE COMMENT 'SO-YYYYMMDD-NNN',
  customer           VARCHAR(100) NOT NULL COMMENT '客户名称/项目地址',
  sub_customer       VARCHAR(100) NULL COMMENT '子客户/安装定位(如 碧桂园X栋X层X房) 标签用',
  door_bom_id        INT          NOT NULL COMMENT '门型',
  color              VARCHAR(50)  NOT NULL COMMENT '颜色',
  qty                INT          NOT NULL COMMENT '订单数量(樘)',
  unit_price         DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '销售单价(非必填,免费送可为0/空,后端兜底归一0)',
  total_amount       DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '订单总金额(=数量×单价,单价空则0)',
  handler_sale       VARCHAR(50)  NOT NULL COMMENT '经手人(销售)',
  order_date         DATE         NOT NULL COMMENT '下单日期',
  expected_ship_date DATE         NULL COMMENT '约定发货日期',
  actual_ship_date   DATE         NULL COMMENT '实际发货日期',
  ship_no            VARCHAR(50)  NULL COMMENT '发货单号',
  handler_ship       VARCHAR(50)  NULL COMMENT '发货经手人',
  pay_date           DATE         NULL COMMENT '收款日期',
  receipt_no         VARCHAR(50)  NULL COMMENT '收据单号',
  handler_finance    VARCHAR(50)  NULL COMMENT '收款经手人',
  door_h             DECIMAL(8,2) NULL COMMENT '门洞高(mm)',
  door_w             DECIMAL(8,2) NULL COMMENT '门洞宽(mm)',
  wall_thick         DECIMAL(8,2) NULL COMMENT '墙厚(mm)',
  style              VARCHAR(50)  NULL COMMENT '款式编号',
  board              VARCHAR(50)  NULL COMMENT '板材',
  -- 台账对齐字段（甲方修改建议2，ARE-105）
  remark             VARCHAR(500) NULL COMMENT '备注(加急/颜色定制/客户交代)',
  paid_amount        DECIMAL(12,2) NULL COMMENT '已付金额(累计已付,欠款=total_amount-paid_amount)',
  edge_band          DECIMAL(6,2) NULL COMMENT '包边(mm)',
  frame_line         VARCHAR(100) NULL COMMENT '套板线条(如 2公分碳素门套碳素线条)',
  customer_type      VARCHAR(50)  NULL COMMENT '客户类别(经销商/直销)',
  address            VARCHAR(200) NULL COMMENT '地址',
  hardware           VARCHAR(100) NULL COMMENT '五金配件备注',
  lock_hole          VARCHAR(50)  NULL COMMENT '锁孔(如 58锁子孔) 门扇内/外标签用',
  pay_method         VARCHAR(20)  NULL COMMENT '付款方式(扫码/现金/转账/赊账)',
  salesperson        VARCHAR(50)  NULL COMMENT '业务员',
  installer          VARCHAR(50)  NULL COMMENT '安装师傅',
  biz_fee            DECIMAL(10,2) NULL COMMENT '业务费',
  status             ENUM('新建','已发货','赊账中','已收款') NOT NULL DEFAULT '新建' COMMENT '新建→已发货→赊账中(部分付款)→已收款(足额=已完成)',
  -- 下料相关字段（原 cutting_list 表合并进来，门洞 door_h/door_w/wall_thick 订单本就有不重复）
  cut_door_height    DECIMAL(8,2) NULL COMMENT '门扇高(mm) 固化值(普通=洞高-默认高扣减)',
  cut_door_width     DECIMAL(8,2) NULL COMMENT '门扇宽(mm) 固化值(普通=洞宽-默认宽扣减)',
  cut_mode           TINYINT NULL DEFAULT 1 COMMENT '下料模式 1普通自动扣尺 2特殊手动录入(NULL=未下料)',
  cut_status         VARCHAR(10) NULL COMMENT '下料状态(已下料,NULL=未下料;生成即已下料,无待下料中间态)',
  cut_date           DATE NULL COMMENT '下料日期',
  cut_handler        VARCHAR(50) NULL COMMENT '下料经手人',
  cut_remark_tags    TEXT NULL COMMENT '下料加工备注标签(JSON.stringify 字符串数组)',
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_bom FOREIGN KEY (door_bom_id) REFERENCES door_bom(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售订单';

-- ============================================================
-- 6. 采购入库单表
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_inbound (
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
CREATE TABLE IF NOT EXISTS material_requisition (
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
CREATE TABLE IF NOT EXISTS inventory_log (
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
CREATE TABLE IF NOT EXISTS purchase_suggestion (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT           NOT NULL,
  suggest_qty DECIMAL(14,3) NOT NULL DEFAULT 0 COMMENT '建议采购数量(ARE-108安全库存驱动:0=不算,采纳时用户自填)',
  order_id    INT           NULL COMMENT '关联订单(BOM驱动历史保留;安全库存驱动为NULL)',
  priority    ENUM('紧急','常规') NOT NULL DEFAULT '常规',
  status      ENUM('待采购','已采购') NOT NULL DEFAULT '待采购',
  inbound_id  INT           NULL COMMENT '采纳后生成的采购入库单id(可溯源)',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sug_material FOREIGN KEY (material_id) REFERENCES materials(id),
  CONSTRAINT fk_sug_order    FOREIGN KEY (order_id) REFERENCES sales_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购建议';

-- 10. 下料单表已合并进 sales_orders（cut_door_height/cut_door_width/cut_mode/cut_status/cut_date/cut_handler/cut_remark_tags），原 cutting_list 表删除

-- ============================================================
-- 11. 业务图片附件表（独立泛化关联，DB只存相对路径，前缀前端拼）
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(20)  NOT NULL COMMENT '业务实体: order/inbound/material/bom/requisition',
  entity_id   INT          NOT NULL COMMENT '业务实体id',
  file_path   VARCHAR(255) NOT NULL COMMENT '相对路径 uploads/2026-08/xxx.jpg',
  file_name   VARCHAR(100) NOT NULL COMMENT '原始文件名',
  file_size   INT          DEFAULT 0 COMMENT '字节',
  uploaded_by VARCHAR(50)  COMMENT '上传人',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务图片附件';

-- ============================================================
-- 11. 客户档案表
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL COMMENT '客户名称(经销商名)',
  customer_type VARCHAR(50)  NULL COMMENT '客户类别(经销商/直销)',
  phone         VARCHAR(30)  NULL COMMENT '联系电话',
  address       VARCHAR(200) NULL COMMENT '地址',
  remark        VARCHAR(500) NULL COMMENT '备注',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户档案';

-- ============================================================
-- 12. 客户安装定位(子客户)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_locations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL COMMENT '所属客户',
  name        VARCHAR(100) NOT NULL COMMENT '安装定位(如 碧桂园3栋1单元501)',
  remark      VARCHAR(200) NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loc_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户安装定位(子客户)';

-- ============================================================
-- 13. 现场测量记录
-- ============================================================
CREATE TABLE IF NOT EXISTS measure_records (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT NOT NULL COMMENT '所属客户',
  location_id     INT NOT NULL COMMENT '安装定位(现场必选/新建)',
  door_h          DECIMAL(8,2) NOT NULL COMMENT '门洞高(mm) 必填',
  door_w          DECIMAL(8,2) NOT NULL COMMENT '门洞宽(mm) 必填',
  wall_thick      DECIMAL(8,2) NOT NULL COMMENT '墙厚(mm) 必填',
  remark          VARCHAR(500) NULL COMMENT '现场备注',
  measured_by     VARCHAR(50) NOT NULL COMMENT '测量人(取JWT.name)',
  measured_at     DATETIME NOT NULL COMMENT '测量时间',
  status          VARCHAR(20) NOT NULL DEFAULT '待转单' COMMENT '待转单/已转单',
  sales_order_id  INT NULL COMMENT '转单后关联的SO id',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meas_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_meas_location FOREIGN KEY (location_id) REFERENCES customer_locations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='现场测量记录';

-- ============================================================
-- 14. 操作日志（全局中间件自动记录写操作）
-- ============================================================
CREATE TABLE IF NOT EXISTS operation_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL COMMENT '操作人id(req.user.id, 未登录NULL)',
  user_name   VARCHAR(50) NULL COMMENT '操作人姓名(req.user.name)',
  method      VARCHAR(10) NOT NULL COMMENT 'POST/PUT/DELETE',
  path        VARCHAR(200) NOT NULL COMMENT '请求路径 /api/xxx/123',
  module      VARCHAR(50) NULL COMMENT '业务模块(按path前缀映射:销售订单/采购入库...)',
  action      VARCHAR(20) NULL COMMENT '动作(创建/更新/删除)',
  target_id   INT NULL COMMENT '路径中的:id(能取则取)',
  status      VARCHAR(10) NULL COMMENT '成功(2xx)/失败(其他)',
  ip          VARCHAR(45) NULL COMMENT '请求IP',
  detail      VARCHAR(500) NULL COMMENT '关键摘要(订单号/客户名等,不存全body)',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_log_user (user_id),
  INDEX idx_log_created (created_at),
  INDEX idx_log_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志';
