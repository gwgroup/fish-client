var onvif = require('onvif');
var util = require('./util');
var CamStreamPusher = require('./cam-stream-pusher');
var CamPreviewImage = require('./cam-preview-image');
let CLIENT_ID = require('./setting-io').config.client_id;
var async = require('async');
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
 *            selected:true
 *          },
 *          {
 *            token:"main",
 *            width:2114,
 *            height:1024,
 *            label:"标清",
 *            org_rtsp_url:'',
 *            rtsp_url:'rtsp://ed.ypcxpt.com/{mac}/{ip}',
 *            selected:false
 *          }
 *        ],
 *        preview_image:null,
 *        ref:{.....原始对象.......},
 *        push_process:null
 *      }
 * }
 */
let camsConfig = new Map();
function getCamsConfig() {
  let result = [];
  camsConfig.forEach(({ profiles, preview_image }, key) => {
    let pfs = [];
    profiles.forEach(({ token, width, height, label, rtsp_url, selected }) => {
      pfs.push({ token, width, height, label, rtsp_url, selected });
    });
    result.push({ key, profiles: pfs, preview_image });
  });
  return result;
}
let QUALITY_LABELS = ['流畅', '标清', '高清', '超清'];
let ACTION_CODES = Object.freeze({ SCAN: 9001, GET_CAMS_CONFIG: 9002, START_PUSH: 9003, STOP_PUSH: 9004, SWITCH_PROFILE: 9005, MOVE: 9006 });
/**
 * 扫描摄像头列表
 * @param {Function} cb 
 */
function scan(cb) {
  //1.清除原先的配置
  camsConfig.clear();
  async.waterfall(
    [
      (cb) => {
        //1执行摄像头发现
        onvif.Discovery.probe({ timeout: 5000 }, cb);
      },
      (cams, cb) => {
        //2构造对象并填充（包括局域网rtsp url,和远程rtsp_url）
        cams.forEach((item) => {
          let key = item.hostname.replace(/\./g, '');
          let config = {
            profiles: [],
            ref: item,
            push_process: null
          };
          //2.1根据清晰度排序，清晰度最低的token排最前
          item.profiles.sort((a, b) => {
            return a.videoEncoderConfiguration.resolution.height > b.videoEncoderConfiguration.resolution.height;
          });
          //2.2循环构造profile
          async.forEachOf(item.profiles, (el, index, cb) => {
            if (index > 2) { return; }
            let token = el["$"].token,
              bounds = el.videoEncoderConfiguration.resolution,
              width = bounds.width,
              height = bounds.height,
              label = QUALITY_LABELS[index],
              //远程rtsp——url
              rtsp_url = `rtsp://ed.ypcxpt.com/${CLIENT_ID}/${key}/${token}`;
            //2.2.1获取原始流地址
            item.getStreamUri({ protocol: 'RTSP', profileToken: token }, function (err, stream) {
              if (err) {
                return cb(err);
              }
              let org_rtsp_url = stream.uri;
              config.profiles.push({ token, width, height, label, org_rtsp_url, rtsp_url, selected: index === 0 ? true : false });
              cb();
            });
          }, (err) => {
            if (err) {
              return cb(err);
            }
            camsConfig.set(key, config);
            cb();
          });
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
      let cerr = undefined;
      if (err) {
        console.error("扫描摄像头发生异常", err);
        cerr = util.BusinessError.build(50010, '未找到摄像头配置')
      }
      cb(cerr, getCamsConfig());
    }
  );
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
    __changeProfile(key, cc, (err) => {
      cb(err, getCamsConfig());
    });
  } else {
    cb(util.BusinessError.build(50011, '未找到摄像头配置'), getCamsConfig());
  }
}

/**
 * 切换流
 * @param {Object} cc 
 * @param {String} token 
 */
function __changeProfile(key, cc, cb) {
  let temp_process = cc.push_process;
  cc.push_process = null;
  noticePushStream(key, (err) => {
    cb(err);
  });
  if (temp_process) {
    temp_process.stop();
  }
}

/**
 * 通知开始推流
 * @param {String} key 
 */
function noticePushStream(key, cb) {
  let cc = camsConfig.get(key);
  if (!cc) { return cb(util.BusinessError.build(50011, '未找到摄像头配置')); }
  if (cc.push_process) {
    return cb();
  }
  let profile = __getSelectedProfile(cc);
  cc.push_process = new CamStreamPusher(profile.org_rtsp_url, profile.rtsp_url);
  cc.push_process.on('close', (ref) => {
    if (cc.push_process === ref) {
      cc.push_process = null;
    }
  });
  setTimeout(() => {
    if (cc.push_process && !cc.push_process.sw.killd) {
      return cb();
    } else {
      return cb(util.BusinessError.build(50012, '设备推流失败！'));
    }
  }, 3000);
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
  if (cc && cc.push_process) {
    cc.push_process.stop();
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
module.exports = { getCamsConfig, switchProfile, noticePushStream, noticeStopStream, scan, move, ACTION_CODES };

scan((err, result) => {
  console.log('开机扫描摄像头', err, JSON.stringify(result));
});

// setTimeout(() => {
//   noticePushStream("192168247", (err) => {
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
