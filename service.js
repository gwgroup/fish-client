var request = require('request'),
  config = require('./config/index'),
  rpio = require('rpio'),
  EventEmitter = require('events').EventEmitter,
  cmdExec = require('child_process').exec,
  ev = new EventEmitter(),
  baseConfig = require('./setting-base'),
  sensor = require('./sensor');

let ACTION_CODES = Object.freeze({ EXEC: 3004, OPEN: 4001, CLOSE: 4002 });

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
baseConfig.config.io.forEach(element => {
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
function open(code, duration) {
  let baseIoConfig = baseConfig.getIoConfig(code);
  let ioStatus = status[baseIoConfig.code];
  if (!baseIoConfig) {
    console.log('未找到配置');
    return;
  }
  if (!baseIoConfig.enabled) {
    console.log('端口已被禁用');
    return;
  }
  if (ioStatus.opened) {
    console.log('重复打开端口');
    return;
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
}

/**
 * 关闭 
 * @param {String} code 
 */
function close(code) {
  let baseIoConfig = baseConfig.getIoConfig(code);
  if (!baseIoConfig) {
    console.log('未找到配置');
    return;
  }
  if (!baseIoConfig.enabled) {
    console.log('端口已被禁用');
    return;
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
}

/**
 * 执行shell
 * @param {Object} body 
 */
function exec(body) {
  let { index, cmd } = body;
  cmdExec(cmd, function (err, stdout, stderr) {
    if (err) {
      console.error('EXEC ERROR: ', stderr);
    } else {
      console.log('EXEC OK:', stdout);
    }
    ev.emit('exec', index, err, stdout, stderr);
  });
}

/**
 * 上报IP
 */
function reportIP(client_id) {
  request.get(config.get_ip_url, { timeout: 3000 }, (err, response, body) => {
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
});

sensor.on('o2', (val) => {
  status['o2'] = val;
});

sensor.on('ph', (val) => {
  status['ph'] = val;
});

module.exports = Object.assign(ev, { rpio, open, close, reportIP, exec, status, ACTION_CODES });