var schedule = require('node-schedule');

var task = { id: "abc", cron: '*/5 * * * * *' };

schedule.scheduleJob(task.id, task.cron, function (fireTime) {
  util.log(fireTime, this);
});
util.log(schedule.scheduledJobs);
setTimeout(() => {
  schedule.cancelJob("abc");
  util.log(schedule.scheduledJobs);
}, 5000);

//schedule.Job

