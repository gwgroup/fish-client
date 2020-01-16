var rpio = require('rpio');

rpio.init({
  gpiomem: false,
  mapping: 'physical'
});

var pin = 36;
var redPin = 18,
  bluePin = 22;
rpio.open(bluePin, rpio.OUTPUT, rpio.LOW);
rpio.open(redPin, rpio.OUTPUT, rpio.LOW);

setTimeout(() => {
  console.log('exit');
  rpio.close(redPin);
  rpio.close(bluePin);
  rpio.close(pin);
  process.exit();
}, 300000);

rpio.open(pin, rpio.INPUT, rpio.PULL_UP);



rpio.poll(pin, pollcb, rpio.POLL_LOW);


function pollcb(cbpin) {

  var pressed = rpio.read(cbpin) ? false : true;
  console.log('Button event on P%d (button currently %s)', cbpin, pressed);

  if (!pressed) {
    //1.触发取消配网事件
    return;
  } else {
    let i = 1;
    let obj = setInterval(() => {
      if (i === 16) {

        startAP();
        clearInterval(obj);
        return;
      }
      if (!rpio.read(cbpin)) {
        i++;
      } else {
        if (i > 1 && i < 16) {
          cancelAP();
        }
        clearInterval(obj);
      }
    }, 500);
  }
}
let tobj = null;
function startAP() {
  console.log('执行配网');
  let cv = false;
  tobj = setInterval(() => {
    rpio.write(redPin, cv ? rpio.HIGH : rpio.LOW);
    rpio.write(bluePin, cv ? rpio.LOW : rpio.HIGH);
    cv = !cv;
  }, 400);
}

function cancelAP() {
  console.log('取消长按');
  if (tobj) {
    clearInterval(tobj);
  }
  rpio.close(redPin);
  rpio.close(bluePin);
}

/*
指示灯 状态有： 1.尝试连接中，2，适配中，3，已连接，4，未连接
*/

function jdd(params) {

}