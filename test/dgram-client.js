const dgram = require('dgram');
const client = dgram.createSocket('udp4');
const multicastAddr = '224.100.100.100';
client.on('close', () => {
  console.log('socket已关闭');
});
client.on('error', (err) => {
  console.log(err);
});
client.on('listening', () => {
  console.log('socket正在监听中...');
  // client.addMembership(multicastAddr);
  // client.setMulticastTTL(128);
  send();
});
client.on('message', (msg, rinfo) => {
  console.log(`receive message from ${rinfo.address}:${rinfo.port}：${msg}`);
});
client.bind();

function send() {
  client.send(JSON.stringify({ ssid: "bgn24", psk: "1211211211" }), '9999', '192.168.12.1');
}