var v8 = require('v8');
var vm = require('vm');
var fs = require('fs');

//读取源文件（JS源码）
var js_code = fs.readFileSync(__dirname + "/url.js").toString();

//生成字节码
var script = new vm.Script(js_code, { produceCachedData: true });
var byte_code = script.cachedData;

//将字节码写入文件
fs.writeFileSync(__dirname + "/url.jsb", byte_code);
