var onvif = require('onvif');
var util = require('./util');
const url = require('url');
var CamStreamPusher = require('./cam-stream-pusher');
var CamPreviewImage = require('./cam-preview-image');
let CLIENT_ID = require('./setting-io').config.client_id;
var async = require('async');
let QUALITY_LABELS = ['流畅', '标清', '高清', '超清'];
let ACTION_CODES = Object.freeze({ SCAN: 9001, GET_CAMS_CONFIG: 9002, START_PUSH: 9003, STOP_PUSH: 9004, SWITCH_PROFILE: 9005, MOVE: 9006, AUTH: 9007 });
/**
 * 数据结构
 * {
 * "ip":{
 *        profiles:[
 *          {
 *            token:"min",
 *            width:640,
 *            height:480,
 *            label:"流畅",
 *            org_rtsp_url:'',
 *            rtsp_url:'rtsp://ed.ypcxpt.com/{mac}/{ip}/${token}',
 *            //push_process:null
 *            selected:true
 *          },
 *          {
 *            token:"main",
 *            width:2114,
 *            height:1024,
 *            label:"标清",
 *            org_rtsp_url:'',
 *            rtsp_url:'rtsp://ed.ypcxpt.com/{mac}/{ip}',
 *            //push_process:null,
 *            selected:false
 *          }
 *        ],
 *        preview_image:null,
 *        //push_process:null
 *        ref:{.....原始对象.......}
 *      }
 * }
 */
//推送进程数组
let pushProcessList = new Map();
let camsConfig = new Map();
/**
 * 未加入可操作名单啊摄像头配置，格式和camsconfig一致
 */
let unlistedCamsConfig = new Map();

/**
 * 获取配置
 * @returns {Object}
 */
function getCamsConfig() {
  let usable_cams = [],
    not_available_cams = [];
  camsConfig.forEach(({ profiles, preview_image, hostname }, key) => {
    let pfs = [];
    profiles.forEach(({ token, width, height, label, rtsp_url, selected }) => {
      pfs.push({ token, width, height, label, rtsp_url, selected });
    });
    usable_cams.push({ key, hostname, profiles: pfs, preview_image });
  });
  unlistedCamsConfig.forEach(({ hostname }, key) => {
    not_available_cams.push({ key, hostname });
  });
  return { usable_cams, not_available_cams };
}

/**
 * 扫描摄像头列表
 * @param {Function} cb 
 */
function scan(cb) {
  //1.清除原先的配置
  camsConfig.clear();
  unlistedCamsConfig.clear();
  async.waterfall(
    [
      (cb) => {
        //1执行摄像头发现
        onvif.Discovery.probe({ timeout: 5000 }, cb);
      },
      (cams, cb) => {
        //2构造对象并填充（包括局域网rtsp url,和远程rtsp_url）
        async.forEachOf(cams, (cam, k, cb) => {
          let key = cam.hostname.replace(/\./g, '');
          let config = {
            profiles: [],
            ref: cam,
            hostname: cam.hostname,
            //push_process: null,
            preview_image: null
          };
          if (!cam.profiles) {
            //如果有密码跳过此摄像头,并加入到未授权的摄像头列表
            unlistedCamsConfig.set(key, config);
            return cb();
          }
          //2.1根据清晰度排序，清晰度最低的token排最前
          cam.profiles.sort((a, b) => {
            return a.videoEncoderConfiguration.resolution.height > b.videoEncoderConfiguration.resolution.height;
          });
          //2.2循环构造profile
          async.forEachOf(cam.profiles, (el, index, cb) => {
            if (index > 2) { return; }
            let token = el["$"].token,
              bounds = el.videoEncoderConfiguration.resolution,
              width = bounds.width,
              height = bounds.height,
              label = QUALITY_LABELS[index],
              //远程rtsp——url
              rtsp_url = `rtsp://ed.ypcxpt.com/${CLIENT_ID}/${key}/${token}`;
            //2.2.1获取原始流地址
            cam.getStreamUri({ protocol: 'RTSP', profileToken: token }, function (err, stream) {
              if (err) {
                return cb(err);
              }
              //重新生成rtsp url（接口获取有可能会确实auth参数）
              let org_rtsp_url = __buildFullRtspUrl(stream.uri, cam.username, cam.password);
              config.profiles.push({ token, width, height, label, org_rtsp_url, rtsp_url, selected: index === 0 ? true : false });
              cb();
            });
          }, (err) => {
            if (!err) {
              camsConfig.set(key, config);
            } else {
              console.error('scan build profile', err);
            }
            cb();
          });
        }, (err) => {
          cb();
        });
      }, (cb) => {
        //3.截取并上传预览图
        async.forEachOf(camsConfig.keys(), (key, index, cb) => {
          let item = camsConfig.get(key);
          if (item.profiles.length === 0) {
            return cb();
          }
          let lastprofile = item.profiles[item.profiles.length - 1];
          CamPreviewImage.obtainImage({ rtsp: lastprofile.org_rtsp_url, client_id: CLIENT_ID, key: key }, (err, url) => {
            //console.log(err, url);
            if (err) {
              return cb(err);
            }
            item.preview_image = url;
            cb();
          });
        }, (err) => {
          cb(err);
        });
      }
    ], (err) => {
      if (err) {
        console.error("扫描摄像头发生异常", err);
      }
      cb(undefined, getCamsConfig());
    }
  );
}

/**
 * 生成完整的rtsp url（带用户/口令）
 * @param {String} baseUrl 
 * @param {String} username 
 * @param {String} password 
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

/**
 * 切换profile
 * @param {String} key 
 * @param {String} token 
 * @param {Function} cb
 */
function switchProfile(key, token, cb) {
  let cc = camsConfig.get(key);
  if (cc) {
    cc.profiles.forEach((item) => {
      item.selected = item.token === token;
    });
    noticePushStream(key, (err) => {
      cb(err, getCamsConfig());
    });
  } else {
    cb(util.BusinessError.build(50011, '未找到摄像头配置'), getCamsConfig());
  }
}
/**
 * 推送进程关闭处理
 * @param {String} key 
 * @param {String} token 
 */
function __process_close_handler(key, token) {
  pushProcessList.set(`${key}_${token}`, null);
}
/**
 * 检查推送状态
 * @param {String} key 
 * @param {String} token 
 */
function __checkPushStatus(key, token) {
  let push_process = pushProcessList.get(`${key}_${token}`);
  //确认进程是否存在，并且非被杀状态
  return push_process && !push_process.sw.killd;
}

/**
 * 创建推送进程
 * @param {String} source_rtsp_url 
 * @param {String} target_rtsp_url 
 * @param {String} key
 * @param {String} token
 * @param {Function} cb
 */
function __createPushProcess(source_rtsp_url, target_rtsp_url, key, token, cb) {
  let push_process = new CamStreamPusher(source_rtsp_url, target_rtsp_url, key, token);
  pushProcessList.set(`${key}_${token}`, push_process);
  push_process.on('close', __process_close_handler);
  setTimeout(() => {
    if (__checkPushStatus(key, token)) {
      return cb();
    } else {
      return cb(util.BusinessError.build(50012, '设备推流失败！'));
    }
  }, 3200);
}

/**
 * 通知进程停止推流
 * @param {String} key 
 * @param {String} token 
 */
function __notice_process_stop(key, token) {
  let push_process = pushProcessList.get(`${key}_${token}`);
  if (push_process && !push_process.sw.killd) {
    push_process.stop();
  }
}

/**
 * 通知开始推流
 * @param {String} key 
 */
function noticePushStream(key, cb) {
  let cc = camsConfig.get(key);
  if (!cc) { return cb(util.BusinessError.build(50011, '未找到摄像头配置')); }
  let profile = __getSelectedProfile(cc);
  if (__checkPushStatus(key, profile.token)) {
    return cb();
  }
  __createPushProcess(profile.org_rtsp_url, profile.rtsp_url, key, profile.token, cb);
}

/**
 * 获取profile
 * @param {Object} obj 
 */
function __getSelectedProfile(obj) {
  let profile = obj.profiles.find((a) => {
    return a.selected;
  });
  return profile;
}

/**
 * 通知停止推流
 * @param {String} key 
 * @param {Function} cb 
 */
function noticeStopStream(key, cb) {
  let cc = camsConfig.get(key);
  if (cc) {
    let profile = __getSelectedProfile(cc).token;
    __notice_process_stop(key, profile.token);
  }
  cb();
}
/**
 * 移动
 * @param {String} key 
 * @param {Object} pan
 */
function move(key, pan) {
  let { x, y } = pan;
  let cc = camsConfig.get(key);
  if (cc) {
    try {
      cc.ref.relativeMove({ x: x ? x : 0, y: y ? y : 0 });
    } catch (ex) {
      console.error(ex);
    }
  }
}

/**
 * 验证摄像头用户
 * @param {String} key 
 * @param {String} password
 * @param {Function} cb 
 */
function auth(key, password, cb) {
  console.log('auth start', key, password);
  //1.尝试获取摄像头对象
  //2.尝试连接
  //3.获取profiles
  //4.获取预览图
  //5.把对象添加到可用列表
  //6.返回完整配置列表
  let cc = unlistedCamsConfig.get(key);
  if (!cc) { return cb(util.BusinessError.build(50011, '未找到摄像头配置')); }
  let cam = cc.ref;
  async.waterfall(
    [
      (cb) => {
        //验证登录
        cam.username = 'admin';
        cam.password = password;
        cam.connect((err) => {
          if (err) {
            return cb(util.BusinessError.build(50031, '口令有误'));
          }
          cb();
        });
      }, (cb) => {
        //获取rtsp url
        //2.1根据清晰度排序，清晰度最低的token排最前
        cam.profiles.sort((a, b) => {
          return a.videoEncoderConfiguration.resolution.height > b.videoEncoderConfiguration.resolution.height;
        });
        //2.2循环构造profile
        async.forEachOf(cam.profiles, (el, index, cb) => {
          if (index > 2) { return; }
          let token = el["$"].token,
            bounds = el.videoEncoderConfiguration.resolution,
            width = bounds.width,
            height = bounds.height,
            label = QUALITY_LABELS[index],
            //远程rtsp——url
            rtsp_url = `rtsp://ed.ypcxpt.com/${CLIENT_ID}/${key}/${token}`;
          //2.2.1获取原始流地址
          cam.getStreamUri({ protocol: 'RTSP', profileToken: token }, function (err, stream) {
            if (err) {
              return cb(err);
            }
            //重新生成rtsp url（接口获取有可能会确实auth参数）
            let org_rtsp_url = __buildFullRtspUrl(stream.uri, cam.username, cam.password);
            cc.profiles.push({ token, width, height, label, org_rtsp_url, rtsp_url, selected: index === 0 ? true : false });
            cb();
          });
        }, (err) => {
          if (err) {
            console.error('auth get stream uri', err);
            cc.profiles.clear();
            return cb(util.BusinessError.build(50032, '与摄像头通讯异常，请稍后重试'));
          }
          cb();
        });
      }, (cb) => {
        //获取预览图
        if (cc.profiles.length === 0) {
          return cb();
        }
        let lastprofile = cc.profiles[cc.profiles.length - 1];
        CamPreviewImage.obtainImage({ rtsp: lastprofile.org_rtsp_url, client_id: CLIENT_ID, key: key }, (err, url) => {
          if (err) {
            console.error('auth obtain image', err);
          }
          cc.preview_image = url;
          cb();
        });
      }, (cb) => {
        //添加到可用配置
        camsConfig.set(key, cc);
        unlistedCamsConfig.delete(key);
        cb();
      }
    ], (err) => {
      if (err) {
        return cb(err);
      }
      cb(undefined, getCamsConfig());
    }
  );
}
module.exports = { getCamsConfig, switchProfile, noticePushStream, noticeStopStream, scan, move, auth, ACTION_CODES };

scan((err, result) => {
  console.log('开机扫描摄像头', err, JSON.stringify(result));
});

// setTimeout(() => {
//   noticePushStream("1921680101", (err) => {
//     console.log("notice", err);
//   });
// }, 15000);

// setTimeout(() => {
//   switchProfile("192168247", "profile_1", (err) => {
//     console.log("switch", err);
//   });
// }, 60000);

// setTimeout(() => {
//   noticeStopStream("192168247", () => {
//     console.log('stop');
//   });
// }, 120000);

// setTimeout(() => {
//   switchProfile("192168247", "profile_1");
// }, 60000);

//console.log(JSON.stringify(cams));
