let __checking = false,
  __upgrading = false,
  currentVersion = require('./package.json').version,
  mac = require('./setting-io').config.client_id,
  Request = require('request'),
  path = require('path'),
  fs = require('fs'),
  moduleMd5 = require('md5'),
  firmwareDir = path.join(__dirname, '../fish-upgrade'),
  util = require('./util'),
  compressing = require('compressing'),
  cp = require('child_process'),
  cmdExec = cp.exec,
  ACTION_CODES = Object.freeze({ GET_VERSION_INFO: 9101, UPGRADE: 9102 });
/**
 * 检查固件更新
 * @param {Object} params 
 */
function checkFirmware(params) {
  if (__upgrading) {
    console.log('执行更新包中，跳过本次检查');
    return;
  }
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
      __checking = false;
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
  let { url, md5, version, describe } = data;
  if (!fs.existsSync(firmwareDir)) {
    fs.mkdirSync(firmwareDir);
  }
  let infoPath = path.join(firmwareDir, 'info.json'),
    tempPath = path.join(firmwareDir, 'fish-client.temp'),
    tarPath = path.join(firmwareDir, 'fish-client.tar');
  Request(url).pipe(fs.createWriteStream(tempPath)).on('close', (err) => {
    if (err) {
      return cb(err);
    }
    let bf = fs.readFileSync(tempPath),
      tarMd5 = moduleMd5(bf);
    if (tarMd5 != data.md5) {
      return cb(new Error('MD5校验错误，下载更新失败，将在一小时后重试'));
    }
    fs.renameSync(tempPath, tarPath);
    fs.writeFileSync(infoPath, JSON.stringify({ md5, version, describe }));
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
    let info = JSON.parse(fs.readFileSync(infoPath));
    return info.version > currentVersion ? info.version : currentVersion;
  }
  return currentVersion;
}


/**
 * 执行更新
 * @param {Function} cb
 */
function upgrade(cb) {
  if (__upgrading) {
    return cb(util.BusinessError.build(70001, '设备正在更新中，请不要重复调用接口'));
  }
  __upgrading = true;
  let workDir = path.join(__dirname, '../');
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
  //2.解压包
  compressing.tar.uncompress(tarPath, workDir).then(() => {
    //3.发送更新成功回调
    cb();
    //4.删除包文件和info.json
    fs.unlinkSync(tarPath);
    fs.unlinkSync(infoPath);
    //5.执行cmd，重启服务
    setTimeout(() => {
      __upgrading = false;
      __restartService();
    }, 2000);
  }).catch((err) => {
    console.error('解压发生异常', err);
    __upgrading = false;
    return cb(util.BusinessError.build(70004, '更新发生错误，请重启设备，如发现不能正常使用，请即时联系客服！'));
  });
}

/**
 * 重启服务
 */
function __restartService() {
  console.log('更新完成，重启服务');
  cmdExec('service fish restart', { maxBuffer: 1024 * 1024 * 10 }, function (err, stdout, stderr) {

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

module.exports = { checkFirmware, upgrade, currentVersion, getVersionInfo, ACTION_CODES };
//checkFirmware();
// upgrade((err) => {
//   console.log(err);
// });
// console.log(getVersionInfo());