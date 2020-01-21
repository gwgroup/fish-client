let Request = require('request'),
  moduleMd5 = require('md5'),
  path = require('path'),
  fs = require('fs'),
  firmwareDir = path.join(__dirname, '../fish-upgrade'),
  url = process.argv[2],
  md5 = process.argv[3],
  version = process.argv[4],
  describe = process.argv[5];

if (!fs.existsSync(firmwareDir)) {
  fs.mkdirSync(firmwareDir);
}
let infoPath = path.join(firmwareDir, 'info.json'),
  tempPath = path.join(firmwareDir, 'fish-client.temp'),
  tarPath = path.join(firmwareDir, 'fish-client.tar');

/**
 * 返回结果
 * @param {Error} err 
 */
function __result(err) {
  process.send({ err });
}
console.log('开始下载固件', url);
Request(url).pipe(fs.createWriteStream(tempPath)).on('close', (err) => {
  if (err) {
    return __result(err.message);
  }
  fs.readFile(tempPath, (err, bf) => {
    if (err) {
      return __result(err.message);
    }
    let tarMd5 = moduleMd5(bf);
    if (tarMd5 != md5) {
      return __result('MD5校验错误，下载更新失败，将在一小时后重试');
    }
    fs.renameSync(tempPath, tarPath);
    fs.writeFileSync(infoPath, JSON.stringify({ md5, version, describe }));
    __result();
  });
});