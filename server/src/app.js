const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/', (req, res) => res.json({ code: 0, msg: 'wood-store server running', data: null }));

// 路由挂载
app.use('/api/auth', require('./routes/auth'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/door-bom', require('./routes/doorBom'));
app.use('/api/sales-orders', require('./routes/salesOrders'));
app.use('/api/purchase-inbound', require('./routes/purchaseInbound'));
app.use('/api/requisition', require('./routes/requisition'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/purchase-suggestion', require('./routes/purchaseSuggestion'));

// 404
app.use((req, res) => res.status(404).json({ code: 404, msg: '接口不存在', data: null }));

module.exports = app;
