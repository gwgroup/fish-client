var io = require('../json/io');
util.log(io.config);
io.config.io[0].enabled = true;
io.save();
util.log(io.config);