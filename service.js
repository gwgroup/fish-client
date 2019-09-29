var request = require('request'),
  config = require('./config/index'),
  rpio = require('rpio'),
  EventEmitter = require('events').EventEmitter,
  cmdExec = require('child_process').exec,
  ev = new EventEmitter(),
  ioConfig = require('./setting-io'),
  triggerConfig = require('./setting-trigger'),
  sensor = require('./sensor'),
  util = require('./util');

let ACTION_CODES = Object.freeze({ EXEC: 3004, OPEN: 4001, CLOSE: 4002 });
const ONLINE_LAMP_PIN = 37;

//===================初始化IO====================
//初始化RPIO
rpio.init({
  gpiomem: true,
  mapping: 'physical'
});

rpio.on('warn', function (arg) {
  console.warn(arg);
});

let baseStatus = { water_temperature: null, o2: null, ph: null, uptime: Date.now() },
  baseToDie = {};
ioConfig.config.io.forEach(element => {
  baseStatus[element.code] = { opened: 0, start_time: null, duration: null };
  baseToDie[element.code] = null;
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
 * @param {int} duration 时长（毫秒）
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
    baseToDie[code] = setTimeout((code) => {
      close(code, () => { });
    }, duration, baseIoConfig.code);
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
  let ioStatus = status[baseIoConfig.code];
  if (!baseIoConfig) {
    return cb(util.BusinessError.build(40021, '未找到配置'));
  }
  // if (!baseIoConfig.enabled) {
  //   return cb(util.BusinessError.build(40022, '设备已被禁用'));
  // }
  if (!ioStatus.opened) {
    return cb(util.BusinessError.build(40023, '不需要重复关闭设备'));
  }

  let reportObject = { start_time: ioStatus.start_time, end_time: Date.now(), plan_duration: ioStatus.duration, io_code: code, io_name: baseIoConfig.name, io_type: baseIoConfig.type, weight_per_second: baseIoConfig.weight_per_second };
  rpio.open(baseIoConfig.pin, rpio.OUTPUT, rpio.LOW);
  ioStatus.opened = 0;
  ioStatus.start_time = null;
  ioStatus.duration = null;
  if (baseToDie[code]) {
    clearTimeout(baseToDie[code]);
  }
  baseToDie[code] = null;
  status.__emit(baseIoConfig.code, ioStatus);
  ev.emit("report", reportObject);
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
    if ((element.condition === ">" && val > element.condition_val) || (element.condition === "<" && val < element.condition_val)) {
      if (element.operaction === "close") {
        if (status[element.io_code].opened) {
          close(element.io_code, () => { });
          console.log("触发任务", "关闭完成", element.io_code, element.duration);
        }
      } else if (element.operaction === "open") {
        if (!status[element.io_code].opened) {
          let duration = element.duration;
          if (element.weight) {
            let wps = ioConfig.getIoConfig(element.io_code).weight_per_second;
            duration = Math.floor(element.weight / wps * 1000);
          }
          if (duration) {
            open(element.io_code, duration, () => { });
            console.log("触发任务", "启动成功", element.io_code, element.duration);
          }
        }
      }
    }
  });
}

/**
 * 在线状态灯
 * @param {Boolean} open 
 */
function onlineLamp(open) {
  if (open) {
    rpio.write(ONLINE_LAMP_PIN, rpio.HIGH);
  } else {
    rpio.close(ONLINE_LAMP_PIN);
  }
}

module.exports = Object.assign(ev, { rpio, open, close, reportIP, exec, status, onlineLamp, ACTION_CODES });