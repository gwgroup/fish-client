var io=require('../json/io');
console.log(io.config);
io.config.io[0].enabled=true;
io.save();
console.log(io.config);