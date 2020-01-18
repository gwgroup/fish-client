var fs = require('fs'),
  moduleMd5 = require('md5');


var mqtt = require('mqtt');
var mqttConfig = require('../config/index').mqtt;
const
  PRODUCT_ID = mqttConfig.productId,
  MQTT_URL = mqttConfig.url,
  CLIENT_ID = 'AAAAAAAAAAAA';
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
    payload: JSON.stringify({ type: 1002 }),
    qos: 2,
    retain: false
  }
});

client.subscribe(SUB_TOPIC, { qos: 0, retain: false });
client.subscribe(PUBLIC_TOPIC, { qos: 0, retain: false });

client.on('connect', function () {
  console.log('连接上服务器');
});

client.on('offline', function () {
  console.log('断开连接');
});
client.on('message', function (topic, message) {

});

setTimeout(() => {


  Request(url).pipe(fs.createWriteStream(tempPath)).on('close', (err) => {
    if (err) {
      return cb(err);
    }
    fs.readFile(tempPath, (err, bf) => {
      if (err) {
        return cb(err);
      }
      let tarMd5 = moduleMd5(bf);
      if (tarMd5 != data.md5) {
        return cb(new Error('MD5校验错误，下载更新失败，将在一小时后重试'));
      }
      fs.renameSync(tempPath, tarPath);
      fs.writeFileSync(infoPath, JSON.stringify({ md5, version, describe }));
      cb();
    });
  });


  // console.time('read');
  // let df = fs.readFileSync('D:/Desktop/小鱼物联/fish-upgrade/fish-client.tar');
  // console.timeEnd('read');
  // console.time('md5');
  // let md5 = moduleMd5(df);
  // console.timeEnd('md5');
  // console.log(md5);
}, 5000);

