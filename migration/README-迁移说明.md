# 木门库存与订单管理系统 - 迁移部署说明（小白版）

> 本文件夹用于在**新机器**上把本系统跑起来，或把当前数据库数据迁移过去。
> 按下面的步骤来，一步一步执行，不需要懂代码。

---

## 一、这份东西是什么

这个系统分两部分：
- **后端**（`server/` 文件夹）：Node.js 写的服务，管数据库和业务逻辑
- **前端**（`web/` 文件夹）：网页界面，用户在浏览器里操作

要跑起来需要三样东西：**Node.js**、**MySQL 数据库**、**本系统代码**。

---

## 二、环境准备（新机器第一次装）

### 1. 装 Node.js（版本 18 或更高）
- 去 https://nodejs.org 下载 LTS 版本（绿色按钮），双击安装，一路下一步
- 装完打开"命令提示符"（按 Win+R 输入 cmd 回车），输入 `node -v`，看到版本号就成功了

### 2. 装 MySQL（版本 8.0）
- 去 https://dev.mysql.com/downloads/installer/ 下载安装
- 安装时设置 root 密码（**记住这个密码**，后面要用），比如设成 `010207`
- 安装完 MySQL 会自动启动服务，端口 3306

### 3. 拿到本系统代码
- 如果是别人给你的压缩包，解压到任意目录，比如 `C:\wood-apple-store-management`
- 如果是从 GitHub 拉的，用 `git clone` 仓库地址

---

## 三、首次部署（按顺序执行）

> 以下命令都在"命令提示符"里执行，先用 `cd` 进入项目根目录，例如：
> `cd C:\wood-apple-store-management`

### 步骤 1：改数据库密码配置
打开 `server\.env` 文件（用记事本），把里面的 `DB_PASSWORD=010207` 改成**你自己的 MySQL root 密码**。
如果 `server\.env` 不存在，把 `server\.env.example` 复制一份改名为 `.env`，再改密码。

### 步骤 2：装后端依赖 + 导入数据库
在命令提示符里执行：
```
cd server
npm install
```
- `npm install` 装依赖（第一次比较慢，等几分钟）

然后导入数据库（建库 + 建表 + 业务数据 + 登录账号一次到位）：
```
mysql -u root -p < src/db/wood_store_data.sql
```
- 导入后即有默认账号：sale / stock / finance，密码 123456
- 若是空库只想补登录账号：`npm run db:seed-users`

### 步骤 3：装前端依赖
```
cd ..\web
npm install
```

### 步骤 4：启动系统
**开两个命令提示符窗口**：

窗口1（启动后端）：
```
cd C:\wood-apple-store-management\server
npm start
```
看到 `🚀 木门库存与订单系统后端已启动` 就成功了，这个窗口**不要关**。

窗口2（启动前端）：
```
cd C:\wood-apple-store-management\web
npm run dev
```
看到 `Local: http://localhost:55080/` 就成功了，这个窗口也**不要关**。

### 步骤 5：打开浏览器访问
浏览器访问 `http://localhost:55080`，用下面账号登录：
- 销售：账号 `sale`，密码 `123456`
- 库管：账号 `stock`，密码 `123456`
- 财务：账号 `finance`，密码 `123456`

---

## 四、数据迁移（把当前数据搬到新机器）

### 场景：换机器，想把现在的订单、库存数据一起搬过去

**在旧机器上导出数据**：
```
cd C:\wood-apple-store-management\migration
导出数据.bat
```
会在当前文件夹生成一个 `wood_store_backup.sql` 文件，这就是你的全部数据。

**把 `wood_store_backup.sql` 拷到新机器**（U盘、网盘都行）。

**在新机器上导入数据**：
先按"三、首次部署"的步骤1、2，然后执行：
```
cd C:\wood-apple-store-management\migration
导入数据.bat
```
它会读取同目录下的 `wood_store_backup.sql` 写入数据库。

> 也可以直接用一键迁移脚本：`一键迁移.bat`（自动导出+建库+导入，适合机器间搬迁）

---

## 五、日常备份

定期导出数据防丢失：
```
cd C:\wood-apple-store-management\migration
导出数据.bat
```
把生成的 `wood_store_backup.sql` 存到安全的地方（网盘、U盘）。

---

## 六、常见问题

**Q：启动后端报错 `EADDRINUSE`？**
A：端口被占用。打开 `server\.env`，把 `PORT=3001` 改成 `PORT=3002`（或其他没被占的），同时改 `web\vite.config.js` 里的代理 `target` 端口。

**Q：登录提示"账号不存在"？**
A：数据库没导入数据，或数据库密码不对。执行 `mysql -u root -p < server/src/db/wood_store_data.sql` 导入，并检查 `server\.env` 的 `DB_PASSWORD`。

**Q：前端打不开？**
A：确认后端先启动了，前端窗口没关。访问地址看前端启动时显示的 `Local:` 那一行。

**Q：别人电脑怎么访问我的系统？**
A：内网部署时，确认两台电脑同一局域网。把后端 `npm start` 改成 `node src/server.js`（监听所有网卡），前端 `npm run dev` 加 `--host`。然后别人用 `http://你的IP:55080` 访问。
