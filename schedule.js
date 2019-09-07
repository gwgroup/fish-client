var schedule = require('node-schedule'),
  planSetting = require('./setting-plan'),
  service = require('./service');
/**
 * 添加任务到调度
 * @param {Object} task 
 */
function __addPlanToSchedule(task) {
  let cron = __buildCronWithPlan(task);
  schedule.scheduleJob(task.id, cron, __planHandler);
}

/**
 * 任务处理程序
 * @param {String} fireTime 
 * @param {Object} job 
 */
function __planHandler(fireTime) {
  let job=this;
  console.log(fireTime, job.name);
  let id = job.name,
    task = planSetting.findPlanWithID(id);
  if (task && task.enabled) {
    service.open(task.io_code, task.duration, (err) => {
      if (err) {
        console.warn("任务启动失败，", err.message);
      }
    });
  } else {
    console.warn('已被禁止或移除的任务', id);
  }
}

/**
 * 生成cron 根据任务
 * @param {Object} plan 
 */
function __buildCronWithPlan(plan) {
  switch (plan.per) {
    case "month":
      return `${plan.second} ${plan.minute} ${plan.hour} ${plan.day_of_month} * *`;
    case "week":
      return `${plan.second} ${plan.minute} ${plan.hour} * * ${plan.day_of_week}`;
    case "day":
      return `${plan.second} ${plan.minute} ${plan.hour} * * *`;
  }
}

//定时任务配置增加
planSetting.on('add_plan', function (task) {
  __addPlanToSchedule(task);
});

//定时任务配置移除
planSetting.on('remove_plan', function (id) {
  schedule.cancelJob(id);
});

//初始化任务
planSetting.config.plan.forEach(__addPlanToSchedule);

module.exports = {};