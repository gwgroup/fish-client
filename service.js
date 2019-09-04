var request = require('request'),
  config = require('./config/index'),
  rpio = require('rpio'),
  EventEmitter = require('events').EventEmitter,
  cmdExec = require('child_process').exec,
  ev = new EventEmitter(),
  ioConfig = require('./setting-io'),
  triggerConfig = require('./setting-trigger'),
  planConfig = require('./setting-plan'),
  sensor = require('./sensor'),
  util = require('./util');

let ACTION_CODES = Object.freeze({ EXEC: 3004, OPEN: 4001, CLOSE: 4002, GET_IO_SETTING: 4011, GET_PLAN_SETTING: 4012, GET_TRIGGER_SETTING: 4013 });

//===================初始化IO====================
//初始化RPIO
rpio.init({
  gpiomem: true,
  mapping: 'physical'
});

rpio.on('warn', function (arg) {
  console.warn(arg);
});

let baseStatus = { water_temperature: null, o2: null, ph: null, uptime: Date.now() };
ioConfig.config.io.forEach(element => {
  baseStatus[element.code] = { opened: 0, start_time: null, duration: null, close_interval: undefined };
});

//设备状态代理，如果状态改变触发事件
let status = new Proxy(baseStatus, {
  get(target, key) {
    return target[key];
  },
  set(target, key, value) {
    let changed = target[key] != value;
    target[key] = value;
    if (changed) {
      ev.emit('status', key, value);
    }
  }
});
/**
 * 私有触发
 */
status.__emit = function (key) {
  ev.emit('status', key, this[key]);
};

/**
 * 打开 
 * @param {String} code 
 * @param {int} duration 时长（秒）
 */
function open(code, duration, cb) {
  let baseIoConfig = ioConfig.getIoConfig(code);
  let ioStatus = status[baseIoConfig.code];
  if (!baseIoConfig) {
    return cb(util.BusinessError.build(40011, '未找到配置'));
  }
  if (!baseIoConfig.enabled) {
    return cb(util.BusinessError.build(40012, '设备已被禁用'));
  }
  if (ioStatus.opened) {
    return cb(util.BusinessError.build(40013, '不能重复打开设备'));
  }
  rpio.open(baseIoConfig.pin, rpio.OUTPUT, rpio.HIGH);
  ioStatus.opened = 1;
  ioStatus.start_time = Date.now();
  if (duration) {
    //定时关闭
    ioStatus.duration = duration;
    ioStatus.close_interval = setTimeout((code) => {
      close(code);
    }, duration * 1000, baseIoConfig.code);
  }
  status.__emit(baseIoConfig.code, ioStatus);
  return cb();
}

/**
 * 关闭 
 * @param {String} code 
 */
function close(code, cb) {
  let baseIoConfig = ioConfig.getIoConfig(code);
  if (!baseIoConfig) {
    return cb(util.BusinessError.build(40021, '未找到配置'));
  }
  if (!baseIoConfig.enabled) {
    return cb(util.BusinessError.build(40022, '设备已被禁用'));
  }
  if (!ioStatus.opened) {
    return cb(util.BusinessError.build(40023, '不需要重复关闭设备'));
  }
  rpio.open(baseIoConfig.pin, rpio.OUTPUT, rpio.LOW);
  ioStatus = status[baseIoConfig.code];
  ioStatus.opened = 0;
  ioStatus.start_time = null;
  ioStatus.duration = null;
  if (ioStatus.close_interval) {
    clearTimeout(ioStatus.close_interval);
  }
  ioStatus.close_interval = null;
  status.__emit(baseIoConfig.code, ioStatus);
  cb();
}

/**
 * 执行shell
 * @param {Object} body 
 */
function exec(body, cb) {
  let { cmd } = body;
  cmdExec(cmd, function (err, stdout, stderr) {
    cb(err, stdout, stderr);
  });
}

/**
 * 上报IP
 */
function reportIP(client_id) {
  request.get(config.get_ip_url + '?client_id=' + client_id, { timeout: 3000 }, (err, response, body) => {
    if (!err && response.statusCode == 200) {
      const info = JSON.parse(body);
      console.log('上报IP', info);
      //status.ip = info.data.local_ip;
    }
  });
}

//监听传感器状态
sensor.on('water_temperature', (val) => {
  status['water_temperature'] = val;
  __triggerTask("water_temperature", val);
});

sensor.on('o2', (val) => {
  status['o2'] = val;
  __triggerTask("o2", val);
});

sensor.on('ph', (val) => {
  status['ph'] = val;
  __triggerTask("ph", val);
});
/**
 * 触发任务
 * @param {String} monitor 
 * @param {Number} val 
 */
function __triggerTask(monitor, val) {
  if (val === null) {
    return;
  }
  let ary = triggerConfig.filterTriggerWithMonitor(monitor);
  ary.forEach((element) => {
    if (element.enabled) {
      if ((element.condition === ">" && val > element.condition_val) || (element.condition === "<" && val < element.condition_val)) {
        if (element.operaction === "close") {
          close(element.io_code, (err) => {
            if (err) {
              console.error("触发任务", "关闭报错", element.io_code, err);
            }
          });
        } else if (element.operaction === "open") {
          if (!ioStatus[element.io_code].opened) {
            open(element.io_code, element.duration, (err) => {
              if (err) {
                console.error("触发任务", "启动报错", element.io_code, err);
              }
            });
            console.log("触发任务", "启动", element.io_code, element.duration);
          } else {
            console.log("触发任务", "跳过", element.io_code);
          }
        }
      }
    }
  });
}

function getIoSetting(body) {
  return ioConfig.config;
}
function getPlanSetting(body) {
  return planConfig.config;
}
function getTriggerSetting(body) {
  return triggerConfig.config;
}

module.exports = Object.assign(ev, { rpio, open, close, reportIP, exec, status, getIoSetting, getPlanSetting, getTriggerSetting, ACTION_CODES });