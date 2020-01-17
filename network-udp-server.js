const dgram = require('dgram');
let util = require('./util');
/**
 * UDP 服务类
 */
class UDPServer {
  /**
   * 创建UDP 组播接收服务类
   * @param {Number} port 端口 默认9999
   * @param {String} multicastAddr 组播地址 默认224.100.100.100
   * @param {Function} handler 消息处理程序
   */
  constructor(port = 9999, multicastAddr = '224.100.100.100', handler) {
    this.server = dgram.createSocket('udp4');
    this.server.on('close', () => {
      util.log('socket已关闭');
    });
    this.server.on('error', (err) => {
      util.error(err);
    });
    this.server.on('listening', () => {
      // this.server.addMembership(multicastAddr);
      // this.server.setMulticastTTL(128);
    });
    this.server.on('message', handler);
    this.server.bind(port);
  }
  /**
   * 发送消息到客户
   * @param {Number} port 端口
   * @param {String} address 地址 
   * @param {String} msg 消息
   */
  sendMsg(port, address, msg, cb) {
    this.server.send(msg, port, address, cb);
  }
  /**
   * 关闭服务
   * @param {Function} cb 
   */
  close(cb) {
    this.server.close(cb);
  }
}
module.exports = UDPServer;