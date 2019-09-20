//var async = require('async');
var mqtt = require('mqtt');
var mqttConfig = require('./config/index').mqtt;
var service = require('./service');
var planSetting = require('./setting-plan');
var triggerSetting = require('./setting-trigger');
var ioSetting = require('./setting-io');

require('./schedule');
//var util = require('./util');
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

console.log('获取到客户端标识', CLIENT_ID);
let LWT_TOPIC = `device/lwt/${PRODUCT_ID}/${CLIENT_ID}`,
  SUB_TOPIC = `device/get/${PRODUCT_ID}/${CLIENT_ID}`,
  PUB_TOPIC = `device/set/${PRODUCT_ID}/${CLIENT_ID}`;

var client = mqtt.connect(MQTT_URL, {
  clientId: CLIENT_ID,
  rejectUnauthorized: false,
  username: mqttConfig.username,
  password: mqttConfig.password,
  ca: mqttConfig.ca,
  reconnecting: true,
  will: {
    topic: LWT_TOPIC,
    payload: JSON.stringify({ type: TYPES.OFFLINE }),
    qos: 2,
    retain: false
  }
});

client.on('connect', function () {
  console.log('连接上服务器');
  client.publish(LWT_TOPIC, JSON.stringify({ type: TYPES.ONLINE }), { qos: 2, retain: false });
  client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.DEVICE_STATUS, status: service.status }));
  client.subscribe(SUB_TOPIC, { qos: 0, retain: false });
  service.reportIP(CLIENT_ID);
  //client.publish(PUB_TOPIC, 'Hello mqtt', { qos: 2, retain: false });
});

client.on('message', function (topic, message) {
  try {
    console.log(topic, message.toString('utf8'));
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
        if (client.connected) {
          client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.DEVICE_STATUS, status: service.status }));
        }
        break;
      case service.ACTION_CODES.EXEC:
        //执行cmd
        service.exec(body, (err, stdout, stderr) => {
          rpc(body.id, err, { stdout, stderr });
        });
        break;
      case planSetting.ACTION_CODES.GET_ALL_PLAN:
        //获取所有定时任务
        rpc(body.id, undefined, planSetting.getAll());
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
        let data = triggerSetting.getAll();
        rpc(body.id, undefined, data);
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
      default:
        console.warn('未找到要处理的类型');
        break;
    }
  } catch (ex) {
    console.error(ex);
  }
});

/**
* 监听设备状态变化
*/
service.on('status', function (key, value) {
  console.log(key, value);
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
 * RPC 返回
 * @param {String} id 
 * @param {Object} data 
 */
function rpc(id, err, data) {
  let error = undefined;
  if (err) {
    error = { message: err.message, code: err.code };
    console.error(err);
  }
  if (client.connected) {
    client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.RPC, id, error, data }));
  }
}

