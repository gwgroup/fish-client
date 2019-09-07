var SerialPort = require('serialport'),
  async = require('async'),
  EventEmitter = require('events').EventEmitter,
  ev = new EventEmitter(),
  port = new SerialPort('/dev/ttyS0', { baudRate: 9600 }, function (err) {
    if (err) {
      return console.error('传感器', '连接串口失败', err.message);
    }
    console.log('传感器', '连接串口成功');
    async.forever((next) => { __searchData(next); }, (err) => {
      console.error('数据检测中断', err);
    });
  }),
  __lock = false;

function lock() {
  console.log('locked!');
  port.read();
  __lock = true;
}
function unlock() {
  console.log('unlock!');
  port.read();
  __lock = false;
}

function __read() {
  if (__lock) {
    return null;
  }
  return port.read.apply(port, arguments);
}

function __write() {
  if (__lock) {
    return false;
  }
  return port.write.apply(port, arguments);
}
function __searchData(cb) {
  __read();
  async.series([(cb) => {
    __write(Buffer.from("06030000000185BD", "hex"));
    setTimeout(() => {
      let data = __read();
      __o2Change(data);
      setTimeout(() => {
        cb();
      }, 1000);
    }, 2000);
  }, (cb) => {
    __write(Buffer.from("0203000000018439", "hex"));
    setTimeout(() => {
      let data = __read();
      __phChange(data);
      setTimeout(() => {
        cb();
      }, 1000);
    }, 2000);
  }, (cb) => {
    __write(Buffer.from("060300010001D47D", "hex"));
    setTimeout(() => {
      let data = __read();
      __waterTemperatureChange(data);
      setTimeout(() => {
        cb();
      }, 1000);
    }, 2000);

  }], (err) => {
    cb();
  });
}

/**
 * 触发ph改变
 * @param {Buffer} data 
 */
function __phChange(data) {
  let val = null;
  if (data && data.length >= 7 && data[0] === 0x02 && data[1] === 0x03 && data[2] === 0x02) {
    val = (data[3] * 256 + data[4]) / 100;
    //console.log('ph\t',val); 
  }
  ev.emit('ph', val);
}

/**
 * 触发水温改变
 * @param {Buffer} data 
 */
function __waterTemperatureChange(data) {
  let val = null;
  if (data && data.length >= 7 && data[0] === 0x06 && data[1] === 0x03 && data[2] === 0x02) {
    val = (data[3] * 256 + data[4]) / 10;
    //console.log('water_temperature\t',val); 
  }
  ev.emit('water_temperature', val);
}

/**
 * 触发溶氧改变
 * @param {Buffer} data 
 */
function __o2Change(data) {
  let val = null;
  if (data && data.length >= 7 && data[0] === 0x06 && data[1] === 0x03 && data[2] === 0x02) {
    val = Math.ceil((data[3] * 256 + data[4]) / 10) / 10;
    //console.log('o2\t',val);  
  }
  ev.emit('o2', val);
}

module.exports = Object.assign(ev, { lock, unlock });

// setTimeout(() => { lock(); }, 10000);
// setTimeout(() => { unlock(); }, 20000);