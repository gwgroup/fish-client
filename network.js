let EventEmitter = require('events').EventEmitter,
  cp = require('child_process'),
  APProcess = require('./network-ap-process'),
  UDPServer = require('./network-udp-server'),
  ev = new EventEmitter(),
  util = require('./util');
let __started = false,//false是没有开始配网，true是已经开始配网
  __cancel_timeout_itv = null,//超时取消配网定时器
  __server = null,//udp组播接收服务
  __ap_process = null;//ap进程

/**
 * 开始配网
 */
function startLink() {
  if (__started) { return; }
  util.log('开始配网');
  __started = true;
  ev.emit('start');
  setTimeout(
    () => {
      runAp();
      __cancel_timeout_itv = setTimeout(cancelLink, 3 * 60 * 1000);
    }, 10);
}
/**
 * 取消配网
 */
function cancelLink() {
  if (!__started) {
    return;
  }
  util.log('取消配网');
  __started = false;
  stopAp();
  reconnectWifi();
  ev.emit('end');
}

/**
 * 启动AP
 */
function runAp() {
  __ap_process = new APProcess();
  __server = new UDPServer(9999, "224.100.100.100", udpHandler);
}

/**
 * 停止AP
 */
function stopAp() {
  if (__cancel_timeout_itv) {
    clearTimeout(__cancel_timeout_itv);
    __cancel_timeout_itv = null;
  }
  if (__server) {
    __server.close();
    __server = null;
  }
  if (__ap_process) {
    __ap_process.stop();
    __ap_process = null;
  }
}

/**
 * 数据处理
 * @param {Buffer} msg 
 * @param {Object} rinfo 
 */
function udpHandler(msg, rinfo) {
  util.log('handler', msg.toString(), rinfo);
  let data = null;
  try {
    data = JSON.parse(msg.toString('utf8'));
  } catch (ex) {
    util.error('配网数据解析错误', ex);
  }
  if (!data) {
    return;
  }
  let { ssid, psk } = data,
    { address, port } = rinfo;
  //校验数据，ok执行通知用户设备已经收到wifissid和密码
  noniceClient(address, port, '1', () => {
    stopAp();
    config(ssid, psk);
    __started = false;
    ev.emit('end');
  });
}

/**
 * 通知客户端
 * @param {String} address 
 * @param {Number} port 
 */
function noniceClient(address, port, message, cb) {
  __server.sendMsg(port, address, message, cb);
}

/**
 * 配置wifi
 * @param {String} ssid 
 * @param {String} psk 
 */
function config(ssid, psk) {
  cp.execFile('/home/work/create_link.sh', [`"${ssid}"`, `"${psk}"`], { shell: true }, (err) => {
    if (err) {
      util.error('配网发生错误', err);
    }
    util.log('配网完成');
  });
}

/**
 * 重新连接wifi
 */
function reconnectWifi() {
  cp.execSync("wpa_cli -i wlan0 reconnect");
}

module.exports = Object.assign(ev, { startLink, cancelLink });


// startLink();

/*
U2FsdGVkX1+8AZuPC1QMclh43gOymx+MWE5qscZICUSSNLXJtIDmbK8fb9XgXaT4Xs8l/9oMeHfK12s0jQZtnA==
*/