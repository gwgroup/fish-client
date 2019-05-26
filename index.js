var mqtt = require('mqtt');
var mqttConfig = require('./config/index').mqtt;
var service = require('./service');
var util = require('./util');
const
  CLIENT_ID = await util.getClient(),
  PRODUCT_ID = mqttConfig.productId,
  LWT_TOPIC = `device/lwt/${PRODUCT_ID}/${CLIENT_ID}`,
  SUB_TOPIC = `device/get/${PRODUCT_ID}/${CLIENT_ID}`,
  PUB_TOPIC = `device/set/${PRODUCT_ID}/${CLIENT_ID}`,
  MQTT_URL = mqttConfig.url,
  TYPES = {
    ONLINE: 1001,
    OFFLINE: 1002,
    DEVICE_STATUS: 3003,
    EXEC: 3004
  };

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
  client.subscribe(SUB_TOPIC, { qos: 0, retain: false });
  //client.publish(PUB_TOPIC, 'Hello mqtt', { qos: 2, retain: false });
});

client.on('message', function (topic, message) {
  try {
    console.log(topic, message.toString('utf8'));
    let //topicObj = util.parseTopic(topic),
      body = JSON.parse(message.toString('utf8'));
    switch (body.type) {
      case service.ACTION_CODES.OPEN_PUMP:
        service.openPump();
        break;
      case service.ACTION_CODES.CLOSE_PUMP:
        service.closePump();
        break;
      case service.ACTION_CODES.EXEC:
        service.exec(body);
        break;
      default:
        console.warn('未找到要处理的类型');
        break;
    }
  } catch (ex) {
    console.error(ex);
  }
});

// var exit = function () {
//   client.publish(LWT_TOPIC, JSON.stringify({ type: 1002 }), { qos: 2, retain: false }, function (err) {
//     client.end();
//     if (err) {
//       console.error(err);
//     }
//   });
// };

/**
 * 监听设备状态变化
 */
service.on('status', function (key, value, status) {
  console.log(key, value, status);
  client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.DEVICE_STATUS, status }));
});

/**
 * 监听exec指令执行消息
 */
service.on('exec', function (index, err, stdout, stderr) {
  client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.EXEC, index, stdout, stderr }));
});

// module.exports = { client, exit };