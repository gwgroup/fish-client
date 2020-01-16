var cp = require('child_process');
var request = require('request');
var path = require('path');
var fs = require('fs');
var util = require('./util');
function obtainImage(params, cb) {
  let { rtsp, client_id, key } = params;
  let dateStr = util.dateFormat(new Date(), 'yyyyMMddhhmmss');
  let filename = `${client_id}_${key}_${dateStr}.jpg`;
  screenshotWithRtsp(rtsp, filename, (err, filePath) => {
    if (err) {
      return cb(err);
    }
    let r = request.post('https://fish.smartbreed.cn/api/util/file_upload', { json: true }, (err, response, body) => {
      fs.unlinkSync(filePath);
      if (err || body.code != 1000) {
        return cb(new Error('上传失败!'));
      }
      cb(undefined, body.data);
    });
    let form = r.form();
    form.append('screenshot', fs.createReadStream(filePath), { filename: filename });
  });
}
/**
 * 抓图
 * @param {String} rtsp 
 * @param {String} filename
 * @param {Function} cb 
 */
function screenshotWithRtsp(rtsp, filename, cb) {
  let dir = path.join(__dirname, '/files/'),
    filePath = path.join(dir, filename);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  cp.exec(`ffmpeg -stimeout 3000000 -i ${rtsp} -y -f mjpeg -t 0.001 ${filePath}`, (err, out, errout) => {
    cb(err, filePath);
  });
}
module.exports = { obtainImage };
//util.time('screenshot');
// obtainImage({ rtsp: 'rtsp://192.168.24.7:554/stream1', client_id: "mac1", key: "192168247" }, (err, url) => {
//   util.log(err, url);
//   util.timeEnd('screenshot');
// });