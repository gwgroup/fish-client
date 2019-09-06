var util = require('./util'),
  path = require('path');

const PATH = path.join(__dirname, '../fish-config/io.json');
var config = Object.assign({}, util.readFromJson(PATH));
let ACTION_CODES = Object.freeze({ ADD_IO: 7001, REMOVE_IO: 7002, ENABLE_IO: 7003, DISABLE_IO: 7004, GET_ALL_IO: 7005 });

let EventEmitter = require('events').EventEmitter,
  ev = new EventEmitter();

//console.log("io config", config, PATH);
/**
 * 保存配置
 */
function save() {
  config.update_time = util.dateFormatWithUTC(new Date(), 'yyyy-MM-dd hh:mm:ss');
  util.writeToJson(PATH, config);
}

/**
 * 根据code 获取IO配置
 * @param {String} code 
 */
function getIoConfig(code) {
  return config.io.find((el) => { return el.code === code; });
}


/**
 * 添加IO
 * @param {Object} io 
 */
function add(io) {
  let exitsio = findPlanWithID(io.code);
  if (exitsio) {
    return console.warn('IO已经存在，不需重复添加', io.code);
  }
  config.io.push(io);
  save();
  ev.emit("add_io", io);
}

/**
 * 移除IO
 * @param {String} code 
 */
function remove(code) {
  let index = config.plan.findIndex((el) => { el.code === code; });
  if (index === -1) { return; }
  config.plan.splice(index, 1);
  save();
  ev.emit("remove_io", code);
}
/**
 * 启用IO
 * @param {String} code 
 */
function enable(code) {
  let io = getIoConfig(code);
  if (io) {
    io.enabled = true;
    save();
    ev.emit("enable_io", io);
  } else {
    console.warn("IO已经不存在，不能启用", code);
  }
}
/**
 * 禁用IO
 * @param {String} code 
 */
function disable(code) {
  let io = getIoConfig(code);
  if (io) {
    io.enabled = false;
    save();
    ev.emit("disable_io", io);
  } else {
    console.warn("IO已经不存在，不能禁用", code);
  }
}

/**
 * 获取所有IO
 */
function getAll() {
  return config.io;
}

module.exports = Object.assign(ev, { config, save, getIoConfig, add, remove, enable, disable, getAll, ACTION_CODES });