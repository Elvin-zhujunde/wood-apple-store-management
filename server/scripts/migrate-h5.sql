-- ============================================================
-- H5 工地录单 - DB 迁移脚本（存量库执行）
-- 适用：已运行旧 schema（users.role = sale/stock/finance）的生产/测试库
-- 全新库无需本脚本，直接跑 server/src/db/init.sql 即可
--
-- 执行顺序严格不可逆：
--   1. 存量账号先迁 boss（必须先于 ALTER，否则删枚举值致存量行失效）
--   2. 改枚举为 boss/worker
--   3. 建 3 张新表（IF NOT EXISTS，安全可重复执行）
--
-- 执行方式（任选其一）：
--   mysql -u root -p wood_store < server/scripts/migrate-h5.sql
--   或在 MySQL 客户端中 SOURCE 该文件
-- ============================================================

USE wood_store;

-- ------------------------------------------------------------
-- 1. 存量账号迁移：旧三角色统一归为 boss（老板/超管）
--    必须先于 ALTER TABLE 执行，否则 ALTER 删除旧枚举值时
--    存量行 role 值会变为 '' 触发 NOT NULL 失效
-- ------------------------------------------------------------
UPDATE users SET role = 'boss' WHERE role IN ('sale', 'stock', 'finance');

-- ------------------------------------------------------------
-- 2. 重构 users.role 枚举为 boss/worker
-- ------------------------------------------------------------
ALTER TABLE users
  MODIFY role ENUM('boss', 'worker') NOT NULL COMMENT '老板(超管)/工人(仅量尺)';

-- ------------------------------------------------------------
-- 3. 追加 H5 子系统 3 张新表（与 init.sql 末尾一致，IF NOT EXISTS 安全）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL COMMENT '客户名称(经销商名)',
  customer_type VARCHAR(50)  NULL COMMENT '客户类别(经销商/直销)',
  phone         VARCHAR(30)  NULL COMMENT '联系电话',
  address       VARCHAR(200) NULL COMMENT '地址',
  remark        VARCHAR(500) NULL COMMENT '备注',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户档案';

CREATE TABLE IF NOT EXISTS customer_locations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL COMMENT '所属客户',
  name        VARCHAR(100) NOT NULL COMMENT '安装定位(如 碧桂园3栋1单元501)',
  remark      VARCHAR(200) NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loc_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户安装定位(子客户)';

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

-- ------------------------------------------------------------
-- 验证（执行后人工确认）
-- ------------------------------------------------------------
-- DESCRIBE users;                              -- role 应为 ENUM('boss','worker')
-- SHOW TABLES LIKE 'customers';                -- 存在
-- SHOW TABLES LIKE 'customer_locations';       -- 存在
-- SHOW TABLES LIKE 'measure_records';          -- 存在
-- SELECT username, role FROM users;            -- 存量已全部 boss
