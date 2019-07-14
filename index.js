var async = require('async');
var mqtt = require('mqtt');
var mqttConfig = require('./config/index').mqtt;
var service = require('./service');
var util = require('./util');
const
  PRODUCT_ID = mqttConfig.productId,
  MQTT_URL = mqttConfig.url,
  TYPES = {
    ONLINE: 1001,
    OFFLINE: 1002,
    DEVICE_STATUS: 3003,
    EXEC: 3004
  };

let CLIENT_ID = undefined;

async.whilst(
  (cb) => {
    CLIENT_ID = util.getClient();
    cb(null, CLIENT_ID === undefined);
  },
  (callback) => {
    console.error('没有获取到客户端标识，请检查网络，系统会在10秒后重试!');
    setTimeout(function () {
      callback(null);
    }, 10000);
  },
  (err) => {
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
      service.reportIP();
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
          case service.ACTION_CODES.OPEN_AERATOR1:
            service.openAerator1();
            break;
          case service.ACTION_CODES.CLOSE_AERATOR1:
            service.closeAerator1();
            break;
          case service.ACTION_CODES.OPEN_AERATOR2:
            service.openAerator2();
            break;
          case service.ACTION_CODES.CLOSE_AERATOR2:
            service.closeAerator2();
            break;
          case service.ACTION_CODES.OPEN_LAMP1:
            service.openLamp1();
            break;
          case service.ACTION_CODES.CLOSE_LAMP1:
            service.closeLamp1();
            break;
          case service.ACTION_CODES.OPEN_LAMP2:
            service.openLamp2();
            break;
          case service.ACTION_CODES.CLOSE_LAMP2:
            service.closeLamp2();
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

    /**
    * 监听设备状态变化
    */
    service.on('status', function (key, value, status) {
      console.log(key, value, status);
      if (client.connected) {
        client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.DEVICE_STATUS, status }));
      }
    });

    /**
     * 监听exec指令执行消息
     */
    service.on('exec', function (index, err, stdout, stderr) {
      if (client.connected) {
        client.publish(PUB_TOPIC, JSON.stringify({ type: TYPES.EXEC, index, stdout, stderr }));
      }
    });
  }
);

