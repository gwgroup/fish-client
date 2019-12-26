/***
 * 改进方案
 * 进程开始后，请求服务器确认是否已经推流成功，如果成功触发推流已开始事件
 * 
 * 
 * 
 */
let EventEmitter = require('events').EventEmitter;
var cp = require('child_process');
var Request = require('request');
var util = require('./util');
const IS_WIN32 = require('os').platform() === 'win32';
class CamSteamPusher extends EventEmitter {
  constructor(url, pushUrl, camKey, token, keepTimeout = 30000, keepCount = 2) {
    super();
    this.__cam_key = camKey;
    this.__token = token;
    this.__org_push_url = url;
    this.__remote_push_url = pushUrl;
    this.__autoInterval = null;
    this.__autoReleaseCount = 0;
    this.keepTimeout = keepTimeout;
    this.keepCount = keepCount;
    util.log("push", url, pushUrl);
    this.sw = cp.spawn(IS_WIN32 ? 'cmd' : '/bin/sh', [IS_WIN32 ? '/c' : '-c', `ffmpeg -stimeout 3000000 -i ${url} -rtsp_transport tcp -vcodec copy -acodec copy -f rtsp ${pushUrl}`], { detached: false });
    this.sw.stdout.on('data', data => {
      this.emit('log', data);
    });
    this.sw.stderr.on('data', data => {
      this.emit('err', data);
    });
    this.sw.on('close', (code) => {
      //util.log('sw close', code, this.__autoInterval);
      this.emit('close', this.__cam_key, this.__token);
      if (this.__autoInterval) {
        clearInterval(this.__autoInterval);
      }
      //this.emit('begin', new Error('推流失败！'));
    });
    this.autoStop();
    //this.checkIsStarted();
  }
  stop() {
    try {

      if (this.sw.stdin.writable) {
        this.sw.stdin.write(Buffer.from([0x71]).toString('ascii'));
      }

      if (!this.sw.killed) {
        this.sw.kill();
      }

    } catch (ex) {
      util.error(ex);
    }
  }
  /**
   * 自动停止方法
   * 每30秒检查一次是否有用户正在访问，如果没有停止推流
   */
  autoStop() {
    var $me = this;
    $me.__autoInterval = setInterval(() => {
      if ($me.sw.killed) {
        clearInterval($me.__autoInterval);
        $me.__autoInterval = null;
        return;
      }
      Request.get(`https://fish.ypcxpt.com/api/util/ed_stream_can_be_release?q=${this.__remote_push_url}`, { json: true }, (err, response, body) => {
        if (err) {
          return;
        }
        if (body.code === 1000 && body.data) {
          $me.__autoReleaseCount++;
          if ($me.__autoReleaseCount === $me.keepCount) {
            util.log('auto release！', $me.__org_push_url, $me.__remote_push_url);
            //可以释放
            clearInterval($me.__autoInterval);
            $me.__autoInterval = null;
            $me.stop();
          }
        } else {
          $me.__autoReleaseCount = 0;
        }
        //util.log($me.__autoReleaseCount);
      });
    }, $me.keepTimeout);
  }
}
module.exports = CamSteamPusher;
