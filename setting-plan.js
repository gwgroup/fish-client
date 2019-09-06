var util = require('./util'),
  path = require('path');
let ACTION_CODES = Object.freeze({ ADD_PLAN: 6001, REMOVE_PLAN: 6002, ENABLE_PLAN: 6003, DISABLE_PLAN: 6004, GET_ALL_PLAN: 6005 });
const PATH = path.join(__dirname, '../fish-config/plan.json');
var config = Object.assign({}, util.readFromJson(PATH));
let EventEmitter = require('events').EventEmitter,
  ev = new EventEmitter();
/**
 * 保存配置
 */
function save() {
  config.update_time = util.dateFormatWithUTC(new Date(), 'yyyy-MM-dd hh:mm:ss');
  util.writeToJson(PATH, config);
}
/**
 * 根据任务ID查找
 * @param {String} id 
 */
function findPlanWithID(id) {
  return config.plan.find((element) => { return element.id === id; });
}

/**
 * 添加任务
 * @param {Object} plan 
 */
function add(plan) {
  let exitsplan = findPlanWithID(plan.id);
  if (exitsplan) {
    return console.warn('任务已经存在，不需重复添加', plan.id);
  }
  config.plan.push(plan);
  save();
  ev.emit("add_plan", plan);
}

/**
 * 移除任务
 * @param {String} id 
 */
function remove(id) {
  let index = config.plan.findIndex((el) => { el.id === id; });
  if (index === -1) { return; }
  config.plan.splice(index, 1);
  save();
  ev.emit("remove_plan", id);
}
/**
 * 启用任务
 * @param {String} id 
 */
function enable(id) {
  let plan = findPlanWithID(id);
  if (plan) {
    plan.enabled = true;
    save();
  } else {
    console.warn("任务已经不存在，不能启用", id);
  }
}
/**
 * 禁用任务
 * @param {String} id 
 */
function disable(id) {
  let plan = findPlanWithID(id);
  if (plan) {
    plan.enabled = false;
    save();
  } else {
    console.warn("任务已经不存在，不能禁用", id);
  }
}

/**
 * 获取所有任务
 */
function getAll() {
  return config.plan;
}

module.exports = Object.assign(ev, { config, save, findPlanWithID, ACTION_CODES, add, remove, enable, disable, getAll });