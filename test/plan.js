var planSetting=require('../setting-plan');
console.log( planSetting.config.plan[4]);
planSetting.config.plan[4].duration=9;
planSetting.save();
