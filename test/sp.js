const SerialPort = require('serialport');
var async = require('async');
const port = new SerialPort('/dev/ttyAMA0', { baudRate: 9600 }, function (err) {

  if (err) {
    return console.log('Error: ', err.message);
  }
  console.log('opened');
  searchData();
  setInterval(() => {
    searchData();
  }, 10000);
});

function searchData() {
  port.read();
  async.series([(cb) => {
    port.write(Buffer.from("06030000000185BD", "hex"));
    setTimeout(() => {
      let data = port.read();
      console.log('溶氧量\t', data);
      setTimeout(() => {
        cb();
      }, 1000);
    }, 2000);
  
   
  }, (cb) => {
    port.write(Buffer.from("0203000000018439", "hex"));
    let data = port.read();
    setTimeout(() => {
      let data = port.read();
      console.log('PH\t', data);
      setTimeout(() => {
        cb();
      }, 1000);
    }, 2000);
  
  }, (cb) => {
    port.write(Buffer.from("060300010001D47D", "hex"));
    setTimeout(() => {
      let data = port.read();
      console.log('水温\t', data);
      setTimeout(() => {
        cb();
      }, 1000);
    }, 2000);
  
  }], (err) => {
    if (err) {
      console.error('查询串口出错', err);
    }
  });
}