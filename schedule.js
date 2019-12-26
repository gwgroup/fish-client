var schedule = require('node-schedule'),
  upgrade = require('./upgrade'),
  planSetting = require('./setting-plan'),
  service = require('./service'),
  ioSetting = require('./setting-io'),
  util = require('./util');

/**
 * 添加任务到调度
 * @param {Object} task 
 */
function __addPlanToSchedule(task) {
  let cron = __buildCronWithPlan(task);
  util.log('add_plan', task.id, cron);
  schedule.scheduleJob(task.id, cron, __planHandler);
}

/**
 * 任务处理程序
 * @param {String} fireTime 
 * @param {Object} job 
 */
function __planHandler(fireTime) {
  let job = this;
  util.log(fireTime, job.name);
  let id = job.name,
    task = planSetting.findPlanWithID(id);
  if (task && task.enabled) {
    let duration = task.duration;
    if (task.weight) {
      let wps = ioSetting.getIoConfig(task.io_code).weight_per_second;
      duration = Math.floor(task.weight / wps * 1000);
    }
    if (duration) {
      service.open(task.io_code, duration, (err) => {
        if (err) {
          util.warn("任务启动失败，", err.message);
        }
      });
    }
  } else {
    util.warn('已被禁止或移除的任务', id);
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
  util.log('remove_plan', id);
  schedule.cancelJob(id);
});

//初始化任务
planSetting.config.plan.forEach(__addPlanToSchedule);

//检查固件更新
let time = new Date(),
  s = time.getSeconds(),
  m = time.getMinutes() + 10;
m = m > 59 ? m - 60 : m;
schedule.scheduleJob('check_firmware', `${s} ${m} * * * *`, upgrade.checkFirmware);
upgrade.checkFirmware();
module.exports = { schedule };