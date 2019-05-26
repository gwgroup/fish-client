var async = require('async');
var client_id = undefined;
var count = 0;
function getClient() {
  count++;
  return count === 9 ? 'xxxxxx' : undefined;
}
async.whilst(
  (cb) => {
    client_id = getClient();
    cb(null, client_id === undefined);
  },
  (callback) => {
    setTimeout(function () {
      callback(null);
    }, 2000);
  },
  (err) => {
    console.log(client_id);
  }
);