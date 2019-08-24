// const crc = require('node-crc');
// console.log(crc.crc16ibm(Buffer.from('060300000001', 'hex')).toString('hex'));

function crc16(buffer, reverse = false) {
  var crc = 0xFFFF;
  var odd;
  for (var i = 0; i < buffer.length; i++) {
    crc = crc ^ buffer[i];

    for (var j = 0; j < 8; j++) {
      odd = crc & 0x0001;
      crc = crc >> 1;
      if (odd) {
        crc = crc ^ 0xA001;
      }
    }
  }
  return reverse ? crc % 0x0100 * 0x0100 + Math.floor(crc / 0x0100) : crc;
}

console.log(crc16(Buffer.from('060300000001', 'hex'), true).toString(16));
