var cp = require('child_process'),
  cmdSpawn = cp.spawn;

const IS_WIN32 = require('os').platform() === 'win32';

/**
 * 执行spawn
 * @param {Object} body 
 * @param {Function} cb 
 */
function spawn(body, cb) {
  let { cmd } = body;
  let cs = cmdSpawn(IS_WIN32 ? 'cmd' : '/bin/sh', [IS_WIN32 ? '/c' : '-c', `${cmd}`], { detached: false });
  cs.on("error", (err) => {
    console.error('spawn', body, err);
  });
  cs.on('close', () => {
    cb();
  });
}

spawn({ cmd: "ffmpeg --version" }, () => {
  console.log("ok");
});