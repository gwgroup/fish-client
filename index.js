var mqtt = require('mqtt');
var mqttConfig = require('./config/index').mqtt;
var service = require('./service');
const
  CLIENT_ID = mqttConfig.clientId,
  PRODUCT_ID = mqttConfig.productId,
  LWT_TOPIC = `device/lwt/${PRODUCT_ID}/${CLIENT_ID}`,
  SUB_TOPIC = `device/get/${PRODUCT_ID}/${CLIENT_ID}`,
  PUB_TOPIC = `device/set/${PRODUCT_ID}/${CLIENT_ID}`,
  MQTT_URL = mqttConfig.url,
  TYPES = { ONLINE: 1001, OFFLINE: 1002, DEVICE_STATUS: 3003 };

var
  client = mqtt.connect(MQTT_URL, {
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
  console.log(LWT_TOPIC, SUB_TOPIC, PUB_TOPIC);
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

service.on('status', function (key, value, status) {
  console.log(key, value, status);
  client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.DEVICE_STATUS, status }));
});

// module.exports = { client, exit };