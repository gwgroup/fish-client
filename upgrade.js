let __upgrading = false,
  currentVersion = require('./package.json').version,
  Request = require('request'),
  path = require('path'),
  fs = require('fs'),
  firmwareDir = path.join(__dirname, '../fish-upgrade'),
  util = require('./util'),
  ACTION_CODES = Object.freeze({ GET_VERSION_INFO: 9101, UPGRADE: 9102 });

/**
 * 执行更新
 * @param {Function} cb
 */
function upgrade(cb) {
  if (__upgrading) {
    return cb(util.BusinessError.build(70001, '设备正在更新中，请不要重复调用接口'));
  }
  __upgrading = true;
  //1.查询包版本是否大于当前版本
  let infoPath = path.join(firmwareDir, 'info.json'),
    tarPath = path.join(firmwareDir, 'fish-client.tar');
  if (!fs.existsSync(infoPath) || !fs.existsSync(tarPath)) {
    __upgrading = false;
    return cb(util.BusinessError.build(70002, '更新包不存在'));
  }
  let info = JSON.parse(fs.readFileSync(infoPath));
  if (info.version <= currentVersion) {
    __upgrading = false;
    return cb(util.BusinessError.build(70003, '不需要更新设备'));
  }
  cb();
  __noticeUpgrade();
}

/**
 * 通知fish-tool执行更新
 */
function __noticeUpgrade() {
  Request.get('http://127.0.0.1:9999/firmware-upgrade', (err, response, body) => {
    if (err) {
      return util.error('noticeUpgrade', err);
    }
    util.log('noticeUpgrade', body);
  });
}

/**
 * 获取版本信息
 */
function getVersionInfo() {
  let result = { current_version: currentVersion, new_version_info: null };
  let infoPath = path.join(firmwareDir, 'info.json');
  if (fs.existsSync(infoPath)) {
    let info = JSON.parse(fs.readFileSync(infoPath));
    result.new_version_info = info;
  }
  return result;
}

module.exports = { upgrade, currentVersion, getVersionInfo, ACTION_CODES };
//checkFirmware();
// upgrade((err) => {
//   util.log(err);
// });
// util.log(getVersionInfo());