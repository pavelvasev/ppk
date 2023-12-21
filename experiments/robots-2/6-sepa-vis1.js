#!/usr/bin/env -S node
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
import * as REDUCE from "./robots/reduce.js"
import * as WRITE_FS from "./robots/write_fs.js"
import * as STENCIL_1D from "./robots/stencil_1d.js"
import * as PRINT from "./robots/print.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let DEBUG_WORKERS= process.env.DEBUG ? true : false

let P = 4
let DN = process.env.DN ? parseInt(process.env.DN) : 1000
console.log({DN})

let sys = Promise.resolve( true ) // пока тянет

sys.then( info => PPK.connect("test",info) ).then( rapi => {
  
    console.log("rapi connected, waiting workers");
    rapi.wait_workers( P ).then( (workers) => {
      console.log("found workers", workers);
      main( rapi, workers.map( w => w.id ) )
    });
  
})

function vis1( rapi, workers, data_port, control_port,prefix ) {
  //PRINT.robot( rapi, "print1", workers, ports )

  let dport = rapi.read_cell( data_port )
  let cport = rapi.create_cell( control_port )

  let cnt = 0
  function tick() {
    cport.submit(1) // запрос
    console.log('submitted to ',control_port)
    dport.next().then( val => {      
      console.log("got data",prefix, cnt++,val)

      rapi.get_one_payload( val.payload_info[0] ).then( data => {
       console.log(data)
       tick()
      })
    })
  }
  tick()
}

////////////////////////////////
//import * as F from "./f.js"

function main( rapi, worker_ids ) {

  let data_port = rapi.open_cell("j1d/output/0")
  let control_port = rapi.open_cell("vis1/control")

  //console.log("output is",output,"final is",final)
  console.log({data_port,control_port})

  vis1( rapi, worker_ids, data_port, control_port, "part-0" )

  console.time("compute")

  // печать результата
  /*
  rapi.read_cell( final[0] ).next().then( value => {
    console.timeEnd("compute")
    console.log("finished",value)      
    rapi.get_one_payload( value.payload_info[0] ).then( data => {
       console.log(data)
    })
  
  })
*/

  

}