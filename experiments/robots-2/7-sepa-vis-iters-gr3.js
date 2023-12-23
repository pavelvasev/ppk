#!/usr/bin/env -S node
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
import * as REDUCE from "./robots/reduce.js"
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

      rapi.get_payloads( val.payload_info ).then( datas => {
       console.log(datas)
       tick()
      })
    })
  }
  tick()
}

////////////////////////////////
//import * as F from "./f.js"

function range(n) {
  let arr = []
  for (let i=0; i<n; i++) arr.push(i)
  return arr
}

function main( rapi, worker_ids ) {
  console.log("ok sending gr")
 
  //rapi.msg({label:"gr",type:"gr"})
  
  rapi.shared("gr_view").submit({type:"gr",id:"gr1id",params:{sx: 10, sy: 10}})
//  rapi.shared("gr_view").submit({type:"gr",id:"gr2id"})
//  rapi.shared("gr_view").subscribe( vals => console.log("S=",vals))

//  rapi.create_cell("gr").submit( {type:"gr",id:"gr1id"} )
//  rapi.create_cell("gr").submit( {type:"gr",id:"gr2id"} )

  //let rbt = MERGE.robot( rapi, "merge1", worker_ids )
  
  let gr1id = rapi.create_cell("gr1id/data")
  let gr1id_p = rapi.create_cell("gr1id/params")
  //gr1id_p.submit({sx: 10, sy: 10})

  // почему-то это проще чем робот
  // + робот нагрузит воркера
  let data_port = range(P).map( x => rapi.read_cell(`pass1/iter/${x}`,{limit:1}) )

  let counter = 0
  function tick() {
    let proms = data_port.map( x => x.next() )
    
    Promise.all( proms ).then( vals => {
      
      let ground = vals[0] // нормализуем
      for (let i=0; i<vals.length; i++) vals[i] = vals[i] - ground
      
      console.log(vals.join(" "))
      
      if (counter++ % 30 == 0) {
        gr1id.submit(vals)
        gr1id_p.submit({title:counter})
      }
      tick()
    })
  }
  
  tick()

  

}