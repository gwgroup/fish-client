var schedule = require('node-schedule'),
planSetting=require('./setting-plan');
//planSetting.config


// var tasks = [];

// /**
//  * 启动调度
//  */
// var run = function () {
//   console.log("1.初始化Schedule服务");
//   tasks.forEach((item) => {
//     schedule.scheduleJob(item.name, item.cron, item.handler);
//   });
// };

// module.exports = { schedule, tasks, run };

// // 清除无效数据
// tasks.push({
//   name: 'CLEAR_DATA',
//   cron: '3 * * *',
//   handler: function () {
//     console.log('CLEAR_DATA','执行清除无效数据任务');
//   }
// });

function add(config){

}

function remove(id){

}

function enable(id){

}

function disable(id){

}

function getAll(){

}

module.exports={add,remove,enable,disable,getAll};