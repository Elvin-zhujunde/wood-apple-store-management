require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 木门库存与订单系统后端已启动: http://127.0.0.1:${PORT}`);
});
