# 部署 Webhook（一键自动部署）

> 触发后自动：上传 deploy 包 → 备份原包 → 保留 .env 与 uploads → 解压新包 → npm install → pm2 reload

## 架构

```
本地 deploy.js 打包 zip
        │  curl POST /deploy (带 token + package=@xxx.zip)
        ▼
服务器 deploy-hook (Express:3100, pm2 守护, 独立于主服务)
        │  execFile bash deploy.sh
        ▼
   备份原包 → 解压新包 → 保留运行时数据 → npm install → pm2 reload
```

**为何独立服务而非挂在主服务里**：主服务重启时 webhook 不中断；webhook 挂了 pm2 自动拉起。两者互不影响。

## 服务器侧首次配置（一次性）

```bash
# 1. 放代码到服务器（假设 /opt/deploy-hook）
scp -r deploy-hook root@服务器:/opt/deploy-hook
ssh root@服务器
cd /opt/deploy-hook
npm install --production

# 2. 配 .env（关键：改 token）
cp .env.example .env
vi .env                 # 改 DEPLOY_TOKEN（openssl rand -hex 32）、APP_DIR、APP_NAME
chmod +x deploy.sh

# 3. 用 pm2 拉起 webhook（主服务也可一并纳入 ecosystem）
pm2 start ecosystem.config.js   # 按 cwd 实际路径改一下
pm2 save
pm2 startup                     # 执行返回的命令，设开机自启

# 4. nginx 反代（推荐，不直接暴露 3100）
#    在 server 块加：
#    location /deploy-hook/ {
#        proxy_pass http://127.0.0.1:3100/;
#        proxy_set_header X-Deploy-Token $http_x_deploy_token;
#    }
```

## 本地触发部署

```bash
# 先打包（仓库根目录）
node deploy.js                # 生成 deploy-YYYYMMDD.zip

# 触发 webhook
TOKEN="你的DEPLOY_TOKEN"
curl -X POST \
  -H "X-Deploy-Token: $TOKEN" \
  -F "package=@deploy-20260814.zip" \
  http://47.120.58.23/deploy-hook/deploy
# 返回 { ok: true, log: "..." } 即成功
```

## 安全要点

| 项 | 措施 |
|---|---|
| 鉴权 | `X-Deploy-Token` 头，固定时间比较防时序攻击；token 用环境变量不写死 |
| 文件 | 仅接受 `.zip`，大小上限 `MAX_PKG_MB`（默认 300MB） |
| 命令注入 | `execFile` 数组传参不经 shell；文件名随机生成不取用户输入 |
| zip slip | 解压到 `mktemp` 专属临时目录，即使 zip 含恶意 `../` 也只影响 /tmp |
| 端口 | 建议 nginx 反代，不直接公网开 3100 |

## 部署时不丢的东西（deploy.sh 自动保留）

- **`server/.env`**：deploy.js 打包带入的是开发环境 .env（密码 010207），部署时用服务器备份里的实际 .env 覆盖回去，避免连不上库
- **`server/uploads/`**：用户上传的图片，用备份还原，避免部署清空历史图片

## 回滚

部署失败或新版有问题，手动回滚（deploy.sh 末尾会打印备份路径）：

```bash
BACKUP="/opt/wood-store.bak-20260814-103000"   # 换成实际备份
APP_DIR="/opt/wood-store"
pm2 reload wood-store-server  # 先停稳
rm -rf "$APP_DIR" && mv "$BACKUP" "$APP_DIR"
pm2 reload wood-store-server
```

## 文件说明

| 文件 | 作用 |
|---|---|
| `server.js` | webhook 服务：接 zip、鉴权、调脚本 |
| `deploy.sh` | 部署脚本：备份/解压/保留数据/依赖/pm2 reload |
| `ecosystem.config.js` | pm2 配置：主服务 + webhook 两个进程 |
| `.env.example` | 配置模板（端口/token/路径） |

## 待确认/无法本地验证

- `APP_DIR`、`APP_NAME`、nginx 路径需按服务器实际填
- `deploy.sh` 为 bash 脚本，本地 Windows 无法测试，需在服务器实测
- pm2 是否已装、主服务当前进程名，需主人确认
