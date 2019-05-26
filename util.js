var os = require("os");

/**
 * 获取MAC
 */
function __getMac() {
  var networkInterfaces = os.networkInterfaces();
  var wlan0 = networkInterfaces.wlan0;
  if (!wlan0) {
    return undefined;
  }
  return wlan0[0].mac.replace(/:/g, '');
}

/**
 * 获取客户端ID
 */
function getClient() {
  return __getMac();;
}

module.exports = { getClient };