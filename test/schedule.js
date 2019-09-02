var schedule = require('node-schedule');

var task={id:"abc",cron:'*/5 * * * * *'};

schedule.scheduleJob(task.id,task.cron, function(fireTime){
  console.log(fireTime);
});
console.log(schedule.scheduledJobs);
setTimeout(() => {
  schedule.cancelJob("abc");
  console.log(schedule.scheduledJobs);
}, 5000);

//schedule.Job

