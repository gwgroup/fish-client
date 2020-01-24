var cp = require('child_process'),
  path = require('path');
let epath = path.join(__dirname, 'upgrade-download-md5.js');
function downloadFirmware({ url, md5, version, describe }, cb) {
  let child = cp.fork(epath, [url, md5, version, describe]);
  child.on('message', (result) => {
    if (result.err) {
      return cb(new Error(result.err));
    }
    cb();
  });
}
module.exports = { downloadFirmware };
// downloadFirmware({ url: 'https://fish.ypcxpt.com/firmware/1.0.8/fish-client.tar', md5: '1203c143830cab1e01ddb0d191645cef', describe: "待修复下载断网问题\n喷血但是" }, (err) => {
//   console.log('OK', err);
// });