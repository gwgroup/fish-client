const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const multicastAddr = '224.100.100.100';
server.on('close', () => {
  console.log('socket已关闭');
});
server.on('error', (err) => {
  console.log(err);
});
server.on('listening', () => {
  console.log('socket正在监听中...');
  server.addMembership(multicastAddr);
  server.setMulticastTTL(128);
  // setInterval(() => {
  //   sendMsg();
  // }, 1500);
});
server.on('message', (msg, rinfo) => {
  console.log(`receive message from ${rinfo.address}:${rinfo.port}`, msg.toString());
  sendMsg(rinfo.port, multicastAddr);
});
function sendMsg(port, address) {
  server.send('你好啊，我是服务端.', port, address);
}
server.bind('9999');