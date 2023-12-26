#!/usr/bin/env -S node
// 8-iter-1 будем печатать просто номер итерации первого самого узла. ну или второго. и ФПС.
// gr - визуализация номеров итераций первая неправильная версия
// 6 - визуализация для 6-comp
// 5-sepa-comp только счет + sepa-vis печать
// 4-sepa разделяем на счет и на визуализацию
// 3-vary рефакторинг
// 2-vary - делаем разных роботов, смотрим что получается. а получилось неплохо
// 1-v2 - рабочий вариант // 236ms
// 1 - первая попытка роботов. они же акторы. они же штуки которые деплоятся на воркерах. 
//     пока без суперроботов 

/*
*/

// далее сильное упрощение по ссылкам на структуры данных. 
// считается что массив упрощенный.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

import * as LIB from "./robots/lib.js"
import * as PASS from "./robots/pass.js"
import * as PASS_EACH from "./robots/pass_each.js"
//import * as REDUCE from "./robots/reduce.js"
import * as WRITE_FS from "./robots/write_fs.js"
import * as STENCIL_1D from "./robots/stencil_1d.js"
import * as PRINT from "./robots/print.js"
import * as MERGE from "./robots/merge.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let DEBUG_WORKERS= process.env.DEBUG ? true : false

//let P = 10
let P = process.env.P ? parseInt(process.env.P) : 10
let DN = process.env.DN ? parseInt(process.env.DN) : 1000
console.log({DN})

let sys = Promise.resolve( true ) // пока тянет

sys.then( info => PPK.connect("test",info,true) ).then( rapi => {
  
     main( rapi )
    //console.log("rapi connected, waiting workers");
    
    //rapi.wait_workers( P ).then( (workers) => {
      //console.log("found workers", workers);
    //main( rapi, workers.map( w => w.id ) )
    //});
  
})

////////////////////////////////
//import * as F from "./f.js"

function range(n) {
  let arr = []
  for (let i=0; i<n; i++) arr.push(i)
  return arr
}

function main( rapi ) {

  let data_port = range(1).map( x => rapi.read_cell(`pass1/iter/${x}`,{limit:1}) )
  //let data_port = rangerapi.read_cell(`pass1/iter/0`,{limit:1})

  let counter = 0
  let t0
  let iter0
  let first_time = true
  function tick() {
    //console.log("tick wait", data_port[0].id ,data_port.length)
    let proms = data_port.map( x => x.next() )
    //proms[0].then( x => console.log(333))    
    Promise.all( proms ).then( vals => {
      //console.log("tack")
      let ground = vals[0] // нормализуем    

      if (first_time) {
        t0 = performance.now()
        iter0 = ground
        first_time = false
      }
      let t1 = performance.now()
      
      if (t1 > t0+1000)
         console.log( "FPS=",1000 * (ground-iter0) / (t1 - t0),"t1=",t1,"iter=",ground )
         //console.log( "node 0 iter=",ground,"iter0=",iter0,"FPS=",1000 * (ground-iter0) / (t1 - t0),"t1=",t1 )
      
      tick()
    })
  }
  
  tick()

  

}