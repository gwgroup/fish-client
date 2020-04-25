let ACTION_CODES = Object.freeze({ CPH4: 4811, CPH686: 4812, CPH916: 4813, CO2SLOPE: 4821, CO2ZERO: 4822 });
var SerialPort = require('serialport'),
  util = require('./util'),
  async = require('async'),
  EventEmitter = require('events').EventEmitter,
  ev = new EventEmitter(),
  port = new SerialPort('/dev/ttyS0', { baudRate: 9600 }, function (err) {
    if (err) {
      return util.error('传感器', '连接串口失败', err.message);
    }
    util.log('传感器', '连接串口成功');
    async.forever((next) => { __searchData(next); }, (err) => {
      util.error('数据检测中断', err);
    });
  }),
  __lock = false;

function lock() {
  util.log('locked!');
  port.read();
  __lock = true;
}
function unlock() {
  util.log('unlock!');
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
    val = Math.floor((data[3] * 256 + data[4]) / 10) / 10;
    //util.log('ph\t',val); 
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
    //util.log('water_temperature\t',val); 
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
    val = Math.floor((data[3] * 256 + data[4]) / 10) / 10;
    //util.log('o2\t',val);  
  }
  ev.emit('o2', val);
}

/**
 * 标定ph4
 * @param {Function} cb 
 */
function calibrationOfPH4_0(cb) {
  lock();
  port.write(Buffer.from("020300040001C5F8", "hex"));
  setTimeout(() => {
    let data = port.read(),
      err = undefined,
      strdata = null;
    if (data && data[0] === 0x02 && data[1] === 0x03) {
      strdata = data.toString("hex");
    } else {
      err = new util.BusinessError(4911, 'ph标定失败');
    }
    cb(err, strdata);
    unlock();
  }, 2000);
}

/**
 * 标定ph 6.86
 * @param {Function} cb 
 */
function calibrationOfPH6_86(cb) {
  lock();
  port.write(Buffer.from("0203000500019438", "hex"));
  setTimeout(() => {
    let data = port.read(),
      err = undefined,
      strdata = null;
    if (data && data[0] === 0x02 && data[1] === 0x03) {
      strdata = data.toString("hex");
    } else {
      err = new util.BusinessError(4911, 'ph标定失败');
    }
    cb(err, strdata);
    unlock();
  }, 2000);
}

/**
 * 标定PH 9.16
 * @param {Function}} cb 
 */
function calibrationOfPH9_16(cb) {
  lock();
  port.write(Buffer.from("0203000600016438", "hex"));
  setTimeout(() => {
    let data = port.read(),
      err = undefined,
      strdata = null;
    if (data && data[0] === 0x02 && data[1] === 0x03) {
      strdata = data.toString("hex");
    } else {
      err = new util.BusinessError(4911, 'ph标定失败');
    }
    cb(err, strdata);
    unlock();
  }, 2000);
}

/**
 * 溶氧传感器 斜率标定（空气）
 * @param {Function} cb 
 */
function calibrationOfO2Slope(cb) {
  lock();
  port.write(Buffer.from("060300040001C47C", "hex"));
  setTimeout(() => {
    let data = port.read(),
      err = undefined,
      strdata = null;
    if (data && data[0] === 0x06 && data[1] === 0x03) {
      strdata = data.toString("hex");
    } else {
      err = new util.BusinessError(4912, '溶氧传感器标定失败');
    }
    cb(err, strdata);
    unlock();
  }, 2000);
}
/**
 * 溶氧传感器 零点标定（无氧水）
 * @param {Function} cb 
 */
function calibrationOfO2Zero(cb) {
  lock();
  port.write(Buffer.from("06030005000195BC", "hex"));
  setTimeout(() => {
    let data = port.read(),
      err = undefined,
      strdata = null;
    if (data && data[0] === 0x06 && data[1] === 0x03) {
      strdata = data.toString("hex");
    } else {
      err = new util.BusinessError(4912, '溶氧传感器标定失败');
    }
    cb(err, strdata);
    unlock();
  }, 2000);
}
module.exports = Object.assign(ev, { lock, unlock, ACTION_CODES, calibrationOfPH4_0, calibrationOfPH6_86, calibrationOfPH9_16, calibrationOfO2Slope, calibrationOfO2Zero });

// setTimeout(() => { lock(); }, 10000);
// setTimeout(() => { unlock(); }, 20000);