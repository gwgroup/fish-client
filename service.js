var rpio = require('rpio');
var EventEmitter = require('events').EventEmitter;
let ev = new EventEmitter();
//设备状态代理，如果状态改变触发事件
let status = new Proxy({ pump: 0 }, {
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
let ACTION_CODES = Object.freeze({ OPEN_PUMP: 3001, CLOSE_PUMP: 3002 });

//初始化RPIO
rpio.init({
  gpiomem: true,
  mapping: 'physical'
});

rpio.on('warn', function (arg) {
  console.warn(arg);
});

rpio.open(3, rpio.OUTPUT, rpio.LOW);
rpio.open(5, rpio.OUTPUT, rpio.LOW);
rpio.open(7, rpio.OUTPUT, rpio.LOW);

/**
 * 打开水泵
 */
function openPump() {
  rpio.write(3, rpio.HIGH);
  rpio.write(5, rpio.HIGH);
  rpio.write(7, rpio.HIGH);
  status.pump = 1;
}

/**
 * 关闭水泵
 */
function closePump() {
  rpio.write(3, rpio.LOW);
  rpio.write(5, rpio.LOW);
  rpio.write(7, rpio.LOW);
  status.pump = 0;
}

module.exports = Object.assign(ev, { rpio, openPump, closePump, status, ACTION_CODES });