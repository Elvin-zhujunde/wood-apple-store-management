// 全局配置（ARE-110：方案 B，文件配置，改值后重启服务生效）
// 扣尺默认值：下料单普通模式按此扣减门洞尺寸算门扇尺寸
//   门扇高 = 门洞高 - defaultHeightCut
//   门扇宽 = 门洞宽 - defaultWidthCut
// 数据依据：木果订单.xlsx 下料单 sheet 2772 行统计——高-40 占 91%（全局统一），宽 60(45%)/70(39%) 双峰取 70
module.exports = {
  cutting: {
    defaultHeightCut: 40,
    defaultWidthCut: 70,
  },
};
