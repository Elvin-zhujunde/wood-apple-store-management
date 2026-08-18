const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 操作日志中间件：拦截 POST/PUT/DELETE 自动写日志（须在业务路由挂载前注册）
app.use(require('./middlewares/operationLog'));

// 静态图片访问（无需登录，内网环境）
// TODO 若以后开放外网，需在此加 token 校验中间件
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查
app.get('/', (req, res) => res.json({ code: 0, msg: 'wood-store server running', data: null }));

// 路由挂载
app.use('/api/auth', require('./routes/auth'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/door-bom', require('./routes/doorBom'));
app.use('/api/sales-orders', require('./routes/salesOrders'));
app.use('/api/cutting-list', require('./routes/cuttingList'));
app.use('/api/purchase-inbound', require('./routes/purchaseInbound'));
app.use('/api/requisition', require('./routes/requisition'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/purchase-suggestion', require('./routes/purchaseSuggestion'));
app.use('/api/attachments', require('./routes/attachments'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/measure', require('./routes/measure'));
app.use('/api/users', require('./routes/users'));
app.use('/api/operation-logs', require('./routes/operationLogs'));

// 404
app.use((req, res) => res.status(404).json({ code: 404, msg: '接口不存在', data: null }));

module.exports = app;
