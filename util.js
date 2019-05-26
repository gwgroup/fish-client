var os = require("os");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
async function getClient() {
  let clientid = undefined;
  while (true) {
    clientid = __getMac();
    if (clientid != undefined) {
      return clientid;
    }
    await sleep(10000);
  }
}
module.exports = { getClient };