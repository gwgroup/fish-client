var request = require('request');
var config = require('./config/index');
var rpio = require('rpio'),
  EventEmitter = require('events').EventEmitter,
  cmdExec = require('child_process').exec,
  ev = new EventEmitter();
//设备状态代理，如果状态改变触发事件
let status = new Proxy({ pump: 0, ip: null, uptime: Date.now() }, {
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
let ACTION_CODES = Object.freeze({ OPEN_PUMP: 3001, CLOSE_PUMP: 3002, EXEC: 3004 });

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
  rpio.open(11, rpio.OUTPUT, rpio.HIGH);
  rpio.open(13, rpio.OUTPUT, rpio.HIGH);
  rpio.open(15, rpio.OUTPUT, rpio.HIGH);
  status.pump = 1;
}

/**
 * 关闭水泵
 */
function closePump() {
  rpio.close(11);
  rpio.close(13);
  rpio.close(15);
  status.pump = 0;
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
module.exports = Object.assign(ev, { rpio, openPump, closePump, reportIP, exec, status, ACTION_CODES });