let EventEmitter = require('events').EventEmitter,
  cp = require('child_process');
class APProcess {
  constructor() {
    cp.execSync('wpa_cli -i wlan0 disconnect');
    cp.execSync('service create_ap start');
  }
  stop() {
    cp.execSync('service create_ap stop');
    //setTimeout(() => {
    //cp.execSync('create_ap --fix-unmanaged');
    cp.execSync('ifconfig wlan0 up');
    //cp.execSync('wpa_cli -i wlan0 reconnect');
    //}, 2000);
  }
}
module.exports = APProcess;

// let ad = new APProcess();
// setTimeout(() => {
//   ad.stop();
// }, 60000);