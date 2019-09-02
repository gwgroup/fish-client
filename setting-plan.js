var util = require('./util'),
  path = require('path');

const PATH = path.join(__dirname, '/json/plan.json');
var config = Object.assign({}, util.readFromJson(PATH));
/**
 * 保存配置
 */
function save() {
  config.update_time = util.dateFormatWithUTC(new Date(), 'yyyy-MM-dd hh:mm:ss');
  util.writeToJson(PATH,config);
}

module.exports = { config, save };