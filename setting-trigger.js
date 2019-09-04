var util = require('./util'),
  path = require('path');

const PATH = path.join(__dirname, '/json/trigger.json');
var config = Object.assign({}, util.readFromJson(PATH));
/**
 * 保存配置
 */
function save() {
  config.update_time = util.dateFormatWithUTC(new Date(), 'yyyy-MM-dd hh:mm:ss');
  util.writeToJson(PATH, config);
}

/**
 * 根据监听器查询code
 * @param {String} code 监听器code 
 */
function filterTriggerWithMonitor(code) {
  return config.trigger.find((item) => {
    return item.monitor === code;
  });
}

module.exports = { config, save, filterTriggerWithMonitor };