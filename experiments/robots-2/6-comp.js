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

import * as VIS from "./robots/vis_pass.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let DEBUG_WORKERS= process.env.DEBUG ? true : false

let P = 4
let DN = process.env.DN ? parseInt(process.env.DN) : 1000
console.log({DN})

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return S.start_workers( 1,P,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100',DEBUG_WORKERS ).then( (statuses) => {
    console.log("workers started",statuses)
    return info
  }).catch( err => {
    console.log("workers error",err)
    process.exit()
  })
  
});

sys.then( info => PPK.connect("test",info) ).then( rapi => {
  
    console.log("rapi connected, waiting workers");
    rapi.wait_workers( P ).then( (workers) => {
      console.log("found workers", workers);
      main( rapi, workers.map( w => w.id ) )
    });
  
})

// формально и это может выдавать робота. почему нет. оно как бы такое и есть.
// надо ток сигнатуру с полями - макро-портами.
function compute1( rapi,worker_ids, n, vis_robot ) {
  let data =  new Float32Array( 2 + DN / P )

  //let p_data = rapi.add_data( data )

  let r1 = STENCIL_1D.robot( rapi, "robo1", worker_ids, (x,left,right) => (left+right)/2 + Math.random() )
  let pr = PASS.robot( rapi, "pass1", worker_ids, n )

  // кольцо
  /*
  LIB.create_port_link( rapi, r1.output, pr.input )
  LIB.create_port_link( rapi, pr.output, r1.input )
  */
  LIB.create_port_link( rapi, r1.output, vis_robot.input )
  LIB.create_port_link( rapi, vis_robot.output, pr.input )
  LIB.create_port_link( rapi, pr.output, r1.input )

  Promise.resolve( rapi.submit_payload_inmem( data ) ).then( pi => {
    // начальные данные  
    r1.input.forEach( input => rapi.create_cell( input.id ).submit( {left:0, right:0, payload_info: [pi] } ) )
  })

  return {output: r1.output, final: pr.finish}
}

// робот - 
// встроенный представитель визуализации
function vis1( rapi,worker_ids, n ) {
}

////////////////////////////////
//import * as F from "./f.js"

function main( rapi, worker_ids ) {

  let visr = VIS.robot( rapi, "vis1", worker_ids)

  let c1 = compute1( rapi, worker_ids, 1001*1000, visr)

  console.log("output is",c1.output,"final is",c1.final)
  console.log("visr.control is",visr.control,"visr.vis is",visr.vis)

  // vis1( rapi, worker_ids, output[0], "part-0" )

  console.time("compute")

  // печать результата
  rapi.read_cell( c1.final[0] ).next().then( value => {
    console.timeEnd("compute")
    console.log("finished",value)
  /*  
    rapi.get_one_payload( value.payload_info[0] ).then( data => {
       console.log(data)
    })
    */
    
  })


}