var config = require('../config/index');
var request = require('request');
request.get(config.get_ip_url, { timeout: 3000 }, (err, response, body) => {
  if (!err && response.statusCode == 200) {


  }
  util.log(err, response, body);
});