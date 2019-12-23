let __checking = false,
  currentVersion = require('./package.json').version,
  mac = require('./setting-io').config.client_id,
  Request = require('request'),
  path = require('path'),
  fs = require('fs'),
  moduleMd5 = require('md5'),
  firmwareDir = path.join(__dirname, '../fish-upgrade');
/**
 * 检查固件更新
 * @param {Object} params 
 */
function checkFirmware(params) {
  if (__checking) {
    console.log('检查更新中，跳过本次请求');
    return;
  }
  __checking = true;
  __checkRequest((err, data) => {
    if (err) {
      console.error('检查更新发生错误', err);
      __checking = false;
      return;
    }
    if (!data) {
      __checking = false;
      return;
    }
    __doDownload(data, (err) => {
      if (err) {
        console.error('固件下载出错', err);
        return;
      }
      console.log('固件已下载完成', data.version);
    });
  });
}

/**
 * 发送检查请求
 * @param {Function} cb 
 */
function __checkRequest(cb) {
  let version = __getlastVersionFlag(currentVersion);
  Request.post(`https://fish.ypcxpt.com/api/util/firmware_check?mac=${mac}&version=${version}`, { json: true }, (err, response, body) => {
    if (err) {
      return cb(err);
    }
    if (body.code === 1000) {
      return cb(undefined, body.data);
    } else {
      return cb(new Error(body.message), null);
    }
  });
}

/**
 * 下载固件
 * @param {Object} data 
 * @param {Function} cb 
 */
function __doDownload(data, cb) {
  let { url } = data;
  if (!fs.existsSync(firmwareDir)) {
    fs.mkdirSync(firmwareDir);
  }
  let infoPath = path.join(firmwareDir, 'info.json'),
    tarPath = path.join(firmwareDir, 'fish-client.tar');
  Request(url).pipe(fs.createWriteStream(tarPath)).on('close', (err) => {
    if (err) {
      return cb(err);
    }
    let bf = fs.readFileSync(tarPath),
      tarMd5 = moduleMd5(bf);
    if (tarMd5 != data.md5) {
      return cb(new Error('MD5校验错误，下载更新失败，将在一小时后重试'));
    }
    fs.writeFileSync(infoPath, JSON.stringify(data), { encoding: 'utf8' });
    cb();
  });
}
/**
 * 取得本地最新版本（包含未执行的更新包）
 * @param {String} currentVersion 
 */
function __getlastVersionFlag(currentVersion) {
  let infoPath = path.join(firmwareDir, 'info.json');
  if (fs.existsSync(infoPath)) {
    let info = JSON.parse(fs.readFileSync(infoPath, { encoding: 'utf8' }));
    return info.version > currentVersion ? info.version : currentVersion;
  }
  return currentVersion;
}

module.exports = { checkFirmware };
// checkFirmware();