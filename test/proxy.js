var __set = function (obj, prop, value) {
  obj[prop] = value;
  util.log(prop);
  return true;
};

var target = { ary: new Proxy([], { set: __set }) };

var p = new Proxy(target, {
  set: __set
});

p.ary.push(37); // operation forwarded to the target
//p.c=100;
p.c = 100;
util.log(target.ary);