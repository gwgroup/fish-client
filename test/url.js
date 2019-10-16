const url = process.mainModule.require('url');
/**
 * 生成完整的rtsp url（带用户/口令）
 * @param {*} baseUrl 
 * @param {*} username 
 * @param {*} password 
 */
function __buildFullRtspUrl(baseUrl, username, password) {
  if (password) {
    var turl = url.parse(baseUrl);
    turl.auth = `${username ? username : "admin"}:${password}`;
    return url.format(turl);
  } else {
    return baseUrl;
  }
}

console.log(__buildFullRtspUrl("rtsp://192.168.0.1/profile_1", undefined, "123456"));