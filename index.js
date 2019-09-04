//var async = require('async');
var mqtt = require('mqtt');
var mqttConfig = require('./config/index').mqtt;
var service = require('./service');
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
    let //topicObj = util.parseTopic(topic),
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
      case service.ACTION_CODES.GET_IO_SETTING:
        //获取io设置
        let data = service.getIoSetting(body);
        rpc(body.id, undefined, data);
        break;
      case service.ACTION_CODES.GET_PLAN_SETTING:
        //获取计划设置
        let data = service.getPlanSetting(body);
        rpc(body.id, undefined, data);
        break;
      case service.ACTION_CODES.GET_TRIGGER_SETTING:
        //获取触发任务设置
        let data = service.getTriggerSetting(body);
        rpc(body.id, undefined, data);
        break;
      case service.ACTION_CODES.EXEC:
        //执行cmd
        service.exec(body, (err, stdout, stderr) => {
          rpc(body.id, err, { stdout, stderr });
        });
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

