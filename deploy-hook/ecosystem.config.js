/**
 * PM2 进程配置（持久化 + 开机自启）
 *
 * 部署 webhook 服务自身（deploy-hook）也用 pm2 守护，与主业务服务隔离：
 *   - 主服务重启时不影响 webhook（部署流程不会中断）
 *   - webhook 挂了 pm2 自动拉起
 *
 * 首次使用：
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup        # 按提示执行返回的那条命令，设开机自启
 *
 * 路径按服务器实际调整（APP_DIR / cwd）。
 */
module.exports = {
  apps: [
    {
      name: 'wood-store-server',
      script: './server/src/server.js',
      cwd: '/opt/wood-store',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
      error_file: '/opt/wood-store/logs/err.log',
      out_file: '/opt/wood-store/logs/out.log',
    },
    {
      name: 'deploy-hook',
      script: './server.js',
      cwd: '/opt/deploy-hook',
      instances: 1,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '100M',
      error_file: '/opt/deploy-hook/logs/err.log',
      out_file: '/opt/deploy-hook/logs/out.log',
    },
  ],
};
