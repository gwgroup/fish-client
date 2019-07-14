var request = require('request');
var config = require('./config/index');
var rpio = require('rpio'),
  EventEmitter = require('events').EventEmitter,
  cmdExec = require('child_process').exec,
  ev = new EventEmitter();
const IO_PUMP = 11,
  IO_AERATOR1 = 13,
  IO_AERATOR2 = 15,
  IO_LAMP1 = 19,
  IO_LAMP2 = 21;

//设备状态代理，如果状态改变触发事件
let status = new Proxy({ pump: 0, aerator1: 0, aerator2: 0, lamp1: 0, lamp2: 0, ip: null, uptime: Date.now() }, {
  get(target, key) {
    return target[key];
  },
  set(target, key, value) {
    let changed = target[key] != value;
    target[key] = value;
    if (changed) {
      ev.emit('status', key, value, status);
    }
  }
});
let ACTION_CODES = Object.freeze({ OPEN_PUMP: 3001, CLOSE_PUMP: 3002, EXEC: 3004, OPEN_LAMP1: 3011, OPEN_LAMP2: 3012, CLOSE_LAMP1: 3021, CLOSE_LAMP2: 3022, OPEN_AERATOR1: 3031, OPEN_AERATOR2: 3032, CLOSE_AERATOR1: 3041, CLOSE_AERATOR2: 3042 });

//初始化RPIO
rpio.init({
  gpiomem: true,
  mapping: 'physical'
});

rpio.on('warn', function (arg) {
  console.warn(arg);
});

/**
 * 打开水泵
 */
function openPump() {
  rpio.open(IO_PUMP, rpio.OUTPUT, rpio.HIGH);
  status.pump = 1;
}

/**
 * 关闭水泵
 */
function closePump() {
  rpio.close(IO_PUMP);
  status.pump = 0;
}

/**
 * 打开增氧机1
 */
function openAerator1() {
  rpio.open(IO_AERATOR1, rpio.OUTPUT, rpio.HIGH);
  status.aerator1 = 1;
}

/**
 * 关闭增氧机1
 */
function closeAerator1() {
  rpio.close(IO_AERATOR1);
  status.aerator1 = 0;
}
/**
 * 打开增氧机2
 */
function openAerator2() {
  rpio.open(IO_AERATOR2, rpio.OUTPUT, rpio.HIGH);
  status.aerator2 = 1;
}

/**
 * 关闭增氧机1
 */
function closeAerator2() {
  rpio.close(IO_AERATOR2);
  status.aerator2 = 0;
}

/**
 * 打开灯1
 */
function openLamp1() {
  rpio.open(IO_LAMP1, rpio.OUTPUT, rpio.HIGH);
  status.lamp1 = 1;
}

/**
 * 关闭灯1
 */
function closeLamp1() {
  rpio.close(IO_LAMP1);
  status.lamp1 = 0;
}

/**
 * 打开灯2
 */
function openLamp2() {
  rpio.open(IO_LAMP2, rpio.OUTPUT, rpio.HIGH);
  status.lamp2 = 1;
}

/**
 * 关闭灯1
 */
function closeLamp2() {
  rpio.close(IO_LAMP2);
  status.lamp2 = 0;
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
function reportIP() {
  request.get(config.get_ip_url, { timeout: 3000 }, (err, response, body) => {
    if (!err && response.statusCode == 200) {
      const info = JSON.parse(body);
      status.ip = info.data.local_ip;
    }
  });
}
module.exports = Object.assign(ev, { rpio, openPump, closePump, openAerator1, closeAerator1, openAerator2, closeAerator2, openLamp1, closeLamp1, openLamp2, closeLamp2, reportIP, exec, status, ACTION_CODES });