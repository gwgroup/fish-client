var request = require('request'),
  config = require('./config/index'),
  rpio = require('rpio'),
  EventEmitter = require('events').EventEmitter,
  cp = require('child_process'),
  cmdExec = cp.exec,
  cmdSpawn = cp.spawn,
  ev = new EventEmitter(),
  ioConfig = require('./setting-io'),
  triggerConfig = require('./setting-trigger'),
  sensor = require('./sensor'),
  util = require('./util'),
  network = require('./network');

const IS_WIN32 = require('os').platform() === 'win32';
let ACTION_CODES = Object.freeze({ EXEC: 3004, SPAWN: 3006, OPEN: 4001, CLOSE: 4002 });
const ONLINE_LAMP_PIN = 37;
const NET_STATUS_RED_PIN = 18,//红灯
  NET_STATUS_BLUE_PIN = 22,//蓝灯
  NET_STATUS_CTRL_PIN = 16;//控制端口
let __net_status_ivt = null,
  __net_status_current = 0;
//===================初始化IO====================
//初始化RPIO
rpio.init({
  gpiomem: false,
  mapping: 'physical'
});

rpio.on('warn', function (arg) {
  util.warn(arg);
});

let baseStatus = { water_temperature: null, o2: null, ph: null, uptime: Date.now() },
  baseToDie = {};
ioConfig.config.io.forEach(element => {
  rpio.close(element.pin);
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
 * 有新增IO，增加IO配置，状态为初始
 */
ioConfig.on('add_io', (io) => {
  baseStatus[io.code] = { opened: 0, start_time: null, duration: null };
  onsole.log('add_io', io.code);
});

/**
 * 移除IO 执行停止IO
 */
ioConfig.on('remove_io', (code) => {
  close(code, () => {
    util.log('remove_io', code);
  });
});

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

  let reportObject = { start_time: ioStatus.start_time, end_time: Date.now(), plan_duration: ioStatus.duration, io_code: code, io_name: baseIoConfig.name, io_type: baseIoConfig.type, weight_per_second: baseIoConfig.weight_per_second, power_w: baseIoConfig.power_w };
  rpio.close(baseIoConfig.pin);
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
 * 上报IP
 */
function reportIP(client_id) {
  request.get(config.get_ip_url + '?client_id=' + client_id, { timeout: 3000 }, (err, response, body) => {
    if (!err && response.statusCode == 200) {
      const info = JSON.parse(body);
      util.log('上报IP', info);
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
          util.log("触发任务", "关闭完成", element.io_code, element.duration);
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
            util.log("触发任务", "启动成功", element.io_code, element.duration);
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
    rpio.open(ONLINE_LAMP_PIN, rpio.OUTPUT, rpio.HIGH);
  } else {
    rpio.close(ONLINE_LAMP_PIN);
  }
}


/**
 * 执行shell
 * @param {Object} body 
 */
function exec(body, cb) {
  let { cmd } = body;
  cmdExec(cmd, { maxBuffer: 1024 * 1024 * 10 }, function (err, stdout, stderr) {
    cb(err, stdout, stderr);
  });
}

/**
 * 执行spawn
 * @param {Object} body 
 * @param {Function} cb 
 */
function spawn(body, cb) {
  let { cmd } = body;
  let cs = cmdSpawn(IS_WIN32 ? 'cmd' : '/bin/sh', [IS_WIN32 ? '/c' : '-c', `${cmd}`], { detached: false });
  cs.on("error", (err) => {
    util.error('spawn', body, err);
  });
  cs.on('close', () => {
    cb();
  });
}

/**
 * =====================NET STATUS==============================
 */
rpio.open(NET_STATUS_BLUE_PIN, rpio.OUTPUT, rpio.LOW);
rpio.open(NET_STATUS_RED_PIN, rpio.OUTPUT, rpio.LOW);
rpio.open(NET_STATUS_CTRL_PIN, rpio.INPUT, rpio.PULL_UP);

rpio.poll(NET_STATUS_CTRL_PIN, (cbpin) => {
  var pressed = rpio.read(cbpin) ? false : true;
  if (!pressed) {
    return;
  } else {
    let i = 1;
    let obj = setInterval(() => {
      if (i === 10) {
        //startAP();
        network.startLink();
        clearInterval(obj);
        return;
      }
      if (!rpio.read(cbpin)) {
        i++;
      } else {
        if (i > 1 && i < 10) {
          network.cancelLink();
        }
        clearInterval(obj);
      }
    }, 500);
  }
}, rpio.POLL_LOW);

network.on('start', () => {
  switchStatusLamp(1);
});
network.on('end', () => {
  switchStatusLamp(2);
  ev.emit('reset_net');
});

/**
 * 切换状态灯
 * @param {Number} status 0.不在线， 1.配网中1，2.尝试连接中，3.在线 
 */
function switchStatusLamp(status) {
  util.log('switch status:', status);
  if (__net_status_current === status) {
    return;
  }
  if (__net_status_current === 1 && status === 0) {
    return;
  }
  __net_status_current = status;
  if (__net_status_ivt) {
    clearInterval(__net_status_ivt);
    __net_status_ivt = null;
  }
  switch (status) {
    case 0:
      rpio.write(NET_STATUS_RED_PIN, rpio.HIGH);
      rpio.write(NET_STATUS_BLUE_PIN, rpio.LOW);
      break;
    case 1:
      let cv = false;
      __net_status_ivt = setInterval(() => {
        rpio.write(NET_STATUS_RED_PIN, cv ? rpio.HIGH : rpio.LOW);
        rpio.write(NET_STATUS_BLUE_PIN, cv ? rpio.LOW : rpio.HIGH);
        cv = !cv;
      }, 400);
      break;
    case 2:
      rpio.write(NET_STATUS_RED_PIN, rpio.LOW);
      let cv2 = true;
      __net_status_ivt = setInterval(() => {
        rpio.write(NET_STATUS_BLUE_PIN, cv2 ? rpio.HIGH : rpio.LOW);
        cv2 = !cv2;
      }, 200);
      break;
    case 3:
      rpio.write(NET_STATUS_RED_PIN, rpio.LOW);
      rpio.write(NET_STATUS_BLUE_PIN, rpio.HIGH);
      break;
  }
}

/**
 * ======================END NET STATUS==================================
 */

module.exports = Object.assign(ev, { rpio, open, close, reportIP, exec, spawn, status, onlineLamp, switchStatusLamp, ACTION_CODES });