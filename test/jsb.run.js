var vm = require('vm');
var fs = require('fs');

//从文件中读取字节码
byte_code = fs.readFileSync(__dirname + "/url.jsb");

//运行
var l = byte_code.slice(8, 12).reduce(function (sum, number, power) { return sum += number * Math.pow(256, power); });
var dummyCode = " ".repeat(l);
script = new vm.Script(dummyCode, { cachedData: byte_code });
script.runInThisContext();
//vm.createContext()