var os = require("os");
fs = require('fs');

class BusinessError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  static build(code, message) {
    return new BusinessError(code, message);
  }
}

/**
 * 获取MAC
 */
function __getMac() {
  var networkInterfaces = os.networkInterfaces();
  var wlan0 = networkInterfaces.wlan0;
  if (!wlan0) {
    return undefined;
  }
  return wlan0[0].mac.replace(/:/g, '');
}

/**
 * 获取客户端ID
 */
function getClient() {
  return __getMac();;
}


/**
 * 按照UTC时间格式化
 * @param {Date} date 
 * @param {String} fmt 
 */
function dateFormatWithUTC(date, fmt) {
  var o = {
    "M+": date.getUTCMonth() + 1, //月份 
    "d+": date.getUTCDate(), //日 
    "h+": date.getUTCHours(), //小时 
    "m+": date.getUTCMinutes(), //分 
    "s+": date.getUTCSeconds(), //秒 
    "q+": Math.floor((date.getUTCMonth() + 3) / 3), //季度 
    "S": date.getUTCMilliseconds() //毫秒 
  };
  if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (date.getUTCFullYear() + "").substr(4 - RegExp.$1.length));
  for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
  return fmt;
}

/**
 * 从文件读取JSON
 * @param {String} path 
 */
function readFromJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(err);
  }
  return null;
}

/**
 * 把对象写入文件
 * @param {String} path 路径
 * @param {Object} obj 对象
 */
function writeToJson(path, obj) {
  try {
    fs.writeFileSync(path, JSON.stringify(obj));
  } catch (err) {
    console.error(err);
  }
}

module.exports = { getClient, dateFormatWithUTC, readFromJson, writeToJson, BusinessError };