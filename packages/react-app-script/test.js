'use strict'

var timer1 = setTimeout(function(){
  console.log(new Date, 1);
}, 1000);
// setTimeout=>uv_timer_start(timer1)  active_handles = 1

var timer2 = setInterval(function(){
  console.log(new Date, 2);
}, 1000);
timer2.unref()
// setTimeout=>uv_timer_start(timer1)  active_handles = 0

var timer3 = setTimeout(function(){
  console.log(new Date, 3);
}, 1000);
// setTimeout=>uv_timer_start(timer1)  active_handles = 1
