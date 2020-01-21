var cp = require('child_process');
let child = cp.fork('./process-child.js', ['url', 'md5']);
child.on('message', (message) => {
  console.log('parent', message);
});
// child.send("drea");

module.exports = {};