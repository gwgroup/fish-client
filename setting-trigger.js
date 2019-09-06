var util = require('./util'),
  path = require('path');
let ACTION_CODES = Object.freeze({ ADD_TRIGGER: 7001, REMOVE_TRIGGER: 7002, ENABLE_TRIGGER: 7003, DISABLE_TRIGGER: 7004, GET_ALL_TRIGGER: 7005 });

const PATH = path.join(__dirname, '../fish-config/trigger.json');
var config = Object.assign({}, util.readFromJson(PATH));
/**
 * 保存配置
 */
function save() {
  config.update_time = util.dateFormatWithUTC(new Date(), 'yyyy-MM-dd hh:mm:ss');
  util.writeToJson(PATH, config);
}

/**
 * 根据code 查询正启用的监听器
 * @param {String} code 监听器code 
 */
function filterTriggerWithMonitor(code) {
  return config.trigger.filter((item) => {
    return item.monitor === code && item.enabled;
  });
}

/**
 * 根据ID查找
 * @param {String} id 
 */
function __findTriggerWithID(id) {
  return config.trigger.find((element) => { return element.id === id; });
}

/**
 * 添加
 * @param {Object} trigger 
 */
function add(trigger) {
  let exitstrigger = __findTriggerWithID(trigger.id);
  if (exitstrigger) {
    return console.warn('触发任务已经存在，不需重复添加', trigger.id);
  }
  config.trigger.push(trigger);
  save();
}

/**
 * 移除
 * @param {String} id 
 */
function remove(id) {
  let index = config.trigger.findIndex((el) => { el.id === id; });
  if (index === -1) { return; }
  config.trigger.splice(index, 1);
  save();
}

/**
 * 启用
 * @param {String} id 
 */
function enable(id) {
  let trigger = __findTriggerWithID(id);
  if (trigger) {
    trigger.enabled = true;
    save();
  } else {
    console.warn("任务已经不存在，不能启用", id);
  }
}

/**
 * 禁用
 * @param {String} id 
 */
function disable(id) {
  let trigger = __findTriggerWithID(id);
  if (trigger) {
    trigger.enabled = false;
    save();
  } else {
    console.warn("任务已经不存在，不能禁用", id);
  }
}

/**
 * 获取所有
 */
function getAll() {
  return config.trigger;
}
module.exports = { config, save, filterTriggerWithMonitor, ACTION_CODES, add, remove, enable, disable, getAll };