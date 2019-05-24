var mqtt = require('mqtt');
var mqttConfig=require('./config/index').mqtt;
const
  CLIENT_ID = mqttConfig.clientId,
  PRODUCT_ID = mqttConfig.productId,
  LWT_TOPIC = `device/lwt/${PRODUCT_ID}/${CLIENT_ID}`,
  SUB_TOPIC = `device/get/${PRODUCT_ID}/${CLIENT_ID}`,
  PUB_TOPIC = `device/set/${PRODUCT_ID}/${CLIENT_ID}`,
  MQTT_URL = mqttConfig.url;

var
  client = mqtt.connect(MQTT_URL, {
    clientId:CLIENT_ID,
    rejectUnauthorized: false,
    username:mqttConfig.username,
    password:mqttConfig.password,
    ca: mqttConfig.ca,
    reconnecting: true,
    will: {
      topic: LWT_TOPIC,
      payload: JSON.stringify({ type: 1002 }),
      qos: 2,
      retain: false
    }
  });

client.on('connect',function () {
  console.log(LWT_TOPIC,SUB_TOPIC,PUB_TOPIC);
  client.publish(LWT_TOPIC, JSON.stringify({ type: 1001 }), { qos: 2, retain: false });
  client.subscribe(SUB_TOPIC, { qos: 2, retain: false });
  //client.publish(PUB_TOPIC, 'Hello mqtt', { qos: 2, retain: false });
});

client.on('message', function (topic, message) {
  console.log(message.toString());
  exit();
});

var exit = function () {
  client.publish(LWT_TOPIC, JSON.stringify({ type: 1002 }), { qos: 2, retain: false }, function (err) {
    client.end();
    if (err) {
      console.error(err);
    }
  });
};