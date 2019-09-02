var util = require('./util'),
  path = require('path');

const PATH = path.join(__dirname, '/json/base.json');
var config = Object.assign({}, util.readFromJson(PATH));
/**
 * 保存配置
 */
function save() {
  config.update_time = util.dateFormatWithUTC(new Date(), 'yyyy-MM-dd hh:mm:ss');
  util.writeToJson(PATH,config);
}

/**
 * 根据code 获取IO配置
 * @param {String} code 
 */
function getIoConfig(code) {
  config.io.find((el) => { return el.code === code; });
}

module.exports = { config, save, getIoConfig };