//var async = require('async');
var mqtt = require('mqtt');
var mqttConfig = require('./config/index').mqtt;
var service = require('./service');
var planSetting = require('./setting-plan');
var triggerSetting = require('./setting-trigger');
var ioSetting = require('./setting-io');
var cams = require('./cams');
var upgrade = require('./upgrade');
var version = upgrade.currentVersion;
var util = require('./util');

util.log('客户端版本v', version);
require('./schedule');
let CLIENT_ID = require('./setting-io').config.client_id;
const
  PRODUCT_ID = mqttConfig.productId,
  MQTT_URL = mqttConfig.url,
  TYPES = {
    ONLINE: 1001,
    OFFLINE: 1002,
    DEVICE_STATUS: 3003,
    EXEC: 3004,
    REPORT: 3005,
    RPC: 5001
  };

util.log('获取到客户端标识', CLIENT_ID);
let LWT_TOPIC = `device/lwt/${PRODUCT_ID}/${CLIENT_ID}`,
  SUB_TOPIC = `device/get/${PRODUCT_ID}/${CLIENT_ID}`,
  PUB_TOPIC = `device/set/${PRODUCT_ID}/${CLIENT_ID}`,
  PUBLIC_TOPIC = "device/public/fish";

var client = mqtt.connect(MQTT_URL, {
  clientId: CLIENT_ID,
  rejectUnauthorized: false,
  username: mqttConfig.username,
  password: mqttConfig.password,
  ca: mqttConfig.ca,
  reconnecting: true,
  resubscribe: true,
  keepalive: 10,
  will: {
    topic: LWT_TOPIC,
    payload: JSON.stringify({ type: TYPES.OFFLINE }),
    qos: 2,
    retain: false
  }
});

client.subscribe(SUB_TOPIC, { qos: 0, retain: false });
client.subscribe(PUBLIC_TOPIC, { qos: 0, retain: false });

client.on('connect', function () {
  util.log('连接上服务器');
  client.publish(LWT_TOPIC, JSON.stringify({ type: TYPES.ONLINE }), { qos: 2, retain: false });
  client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.DEVICE_STATUS, status: service.status }));
  service.reportIP(CLIENT_ID);
  //service.onlineLamp(true);
  service.switchStatusLamp(3);
  //client.publish(PUB_TOPIC, 'Hello mqtt', { qos: 2, retain: false });
});

client.on('offline', function () {
  //service.onlineLamp(false);
  service.switchStatusLamp(0);
});
client.on('message', function (topic, message) {
  try {
    util.log(topic, message.toString('utf8'));
    body = JSON.parse(message.toString('utf8'));
    switch (body.sub_type) {
      case service.ACTION_CODES.OPEN:
        //打开IO
        service.open(body.io_code, body.duration, (err) => {
          rpc(body.id, err);
        });
        break;
      case service.ACTION_CODES.CLOSE:
        //关闭IO
        service.close(body.io_code, (err) => {
          rpc(body.id, err);
        });
        break;
      case TYPES.DEVICE_STATUS:
        //上报设备状态
        if (client.connected) {
          client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.DEVICE_STATUS, status: service.status }));
          service.reportIP(CLIENT_ID);
        }
        break;
      case service.ACTION_CODES.EXEC:
        //执行cmd
        service.exec(body, (err, stdout, stderr) => {
          rpc(body.id, err, { stdout, stderr });
        });
        break;
      case service.ACTION_CODES.SPAWN:
        //执行spawn
        service.spawn(body, () => {
          rpc(body.id);
        });
        break;
      case planSetting.ACTION_CODES.GET_ALL_PLAN:
        //获取所有定时任务
        rpc(body.id, undefined, getAllPlanWithMate());
        break;
      case planSetting.ACTION_CODES.ADD_PLAN:
        //添加定时任务
        planSetting.add(body.plan);
        rpc(body.id);
        break;
      case planSetting.ACTION_CODES.REMOVE_PLAN:
        //移除定时任务
        planSetting.remove(body.plan.id);
        rpc(body.id);
        break;
      case planSetting.ACTION_CODES.ENABLE_PLAN:
        //启用定时任务
        planSetting.enable(body.plan.id);
        rpc(body.id);
        break;
      case planSetting.ACTION_CODES.DISABLE_PLAN:
        //禁用定时任务
        planSetting.disable(body.plan.id);
        rpc(body.id);
        break;
      case planSetting.ACTION_CODES.EDIT_PLAN:
        //修改定时任务
        planSetting.edit(body.plan);
        rpc(body.id);
        break;
      case triggerSetting.ACTION_CODES.GET_ALL_TRIGGER:
        //获取所有触发任务
        rpc(body.id, undefined, getAllTriggerWithMate());
        break;
      case triggerSetting.ACTION_CODES.ADD_TRIGGER:
        //添加触发任务
        triggerSetting.add(body.trigger);
        rpc(body.id);
        break;
      case triggerSetting.ACTION_CODES.REMOVE_TRIGGER:
        //移除触发任务
        triggerSetting.remove(body.trigger.id);
        rpc(body.id);
        break;
      case triggerSetting.ACTION_CODES.ENABLE_TRIGGER:
        //启用触发任务
        triggerSetting.enable(body.trigger.id);
        rpc(body.id);
        break;
      case triggerSetting.ACTION_CODES.DISABLE_TRIGGER:
        //禁用触发任务
        triggerSetting.disable(body.trigger.id);
        rpc(body.id);
        break;
      case triggerSetting.ACTION_CODES.EDIT_TRIGGER:
        //修改触发任务
        triggerSetting.edit(body.trigger);
        rpc(body.id);
        break;
      case ioSetting.ACTION_CODES.GET_ALL_IO:
        //获取所有IO
        rpc(body.id, undefined, ioSetting.getAll());
        break;
      case ioSetting.ACTION_CODES.ADD_IO:
        //添加IO
        ioSetting.add(body.io);
        rpc(body.id);
        break;
      case ioSetting.ACTION_CODES.REMOVE_IO:
        //移除io
        ioSetting.remove(body.io.code);
        rpc(body.id);
        break;
      case ioSetting.ACTION_CODES.ENABLE_IO:
        //启用io
        ioSetting.enable(body.io.code);
        rpc(body.id);
        break;
      case ioSetting.ACTION_CODES.DISABLE_IO:
        //禁用io
        ioSetting.disable(body.io.code);
        rpc(body.id);
        break;
      case ioSetting.ACTION_CODES.RENAME_IO:
        //重命名IO
        ioSetting.rename(body.io.code, body.io.name);
        rpc(body.id);
        break;
      case ioSetting.ACTION_CODES.CALIBRATION_FEEDER:
        //校准投喂量
        ioSetting.calibrationFeeder(body.io.code, body.io.weight_per_second);
        rpc(body.id);
        break;
      case ioSetting.ACTION_CODES.POWER:
        //设置功耗
        ioSetting.power(body.io.code, body.io.power_w);
        rpc(body.id);
        break;
      case cams.ACTION_CODES.SCAN:
        //重新扫描摄像头
        cams.scan((err, result) => {
          rpc(body.id, err, result);
        });
        break;
      case cams.ACTION_CODES.GET_CAMS_CONFIG:
        //获取摄像头配置
        rpc(body.id, undefined, cams.getCamsConfig());
        break;
      case cams.ACTION_CODES.START_PUSH:
        //通知开始推流
        cams.noticePushStream(body.cam_key, (err) => {
          rpc(body.id, err);
        });
        break;
      case cams.ACTION_CODES.STOP_PUSH:
        //通知停止推流
        cams.noticeStopStream(body.cam_key, (err) => {
          rpc(body.id, err);
        });
        break;
      case cams.ACTION_CODES.SWITCH_PROFILE:
        //切换清晰度
        cams.switchProfile(body.cam_key, body.profile_token, (err, result) => {
          rpc(body.id, err, result);
        });
        break;
      case cams.ACTION_CODES.MOVE:
        //移动摄像头
        cams.move(body.cam_key, body.pan);
        rpc(body.id, undefined);
        break;
      case cams.ACTION_CODES.AUTH:
        //尝试登录摄像头
        cams.auth(body.cam_key, body.password, (err, result) => {
          rpc(body.id, err, result);
        });
        break;
      case upgrade.ACTION_CODES.GET_VERSION_INFO:
        //获取固件版本信息
        let result = upgrade.getVersionInfo();
        util.log('GET_VERSION_INFO', result);
        rpc(body.id, undefined, result);
        break;
      case upgrade.ACTION_CODES.UPGRADE:
        //升级固件
        upgrade.upgrade((err) => {
          rpc(body.id, err);
        });
        break;
      default:
        util.warn('未找到要处理的类型');
        break;
    }
  } catch (ex) {
    util.error(ex);
  }
});

/**
* 监听设备状态变化
*/
service.on('status', function (key, value) {
  util.log(key, value);
  let status = {};
  status[key] = value;
  if (client.connected) {
    client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.DEVICE_STATUS, status }));
  }
});
/**
* 监听设备io关闭时产生的报表
*/
service.on('report', function (report) {
  if (client.connected) {
    client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.REPORT, report }));
  }
});

/**
 * 重置网络配置后,尝试立即重连MQTT
 */
service.on('reset_net', function () {
  util.log('reset_net');
  client.reconnect();
});

/**
 * RPC 返回
 * @param {String} id 
 * @param {Object} data 
 */
function rpc(id, err, data) {
  let error = undefined;
  if (err) {
    error = { message: err.message, code: err.code };
    util.error(err);
  }
  if (client.connected) {
    client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.RPC, id, error, data }));
  }
}

/**
 * 获取带有详细信息的所有任务
 */
function getAllPlanWithMate() {
  let result = [];
  planSetting.getAll().forEach(element => {
    let io_code = element.io_code,
      ioConfig = ioSetting.getIoConfig(io_code);
    if (ioConfig) {
      result.push(Object.assign({ io_name: ioConfig.name, io_type: ioConfig.type, io_enabled: ioConfig.enabled }, element));
    }
  });
  return result;
}
/**
 * 获取带有详细信息的所有触发器
 */
function getAllTriggerWithMate() {
  let result = [];
  triggerSetting.getAll().forEach(element => {
    let io_code = element.io_code,
      ioConfig = ioSetting.getIoConfig(io_code);
    if (ioConfig) {
      result.push(Object.assign({ io_name: ioConfig.name, io_type: ioConfig.type, io_enabled: ioConfig.enabled }, element));
    }
  });
  return result;
}