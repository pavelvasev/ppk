#!/usr/bin/env -S node
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

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let DEBUG_WORKERS= process.env.DEBUG ? true : false

let P = 4
let DN = process.env.DN ? parseInt(process.env.DN) : 1000
console.log({DN})

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return  S.start_workers( 1,P,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100',DEBUG_WORKERS ).then( (statuses) => {
    console.log("workers started",statuses)
    return true
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

////////////////////////////////
//import * as F from "./f.js"

function main( rapi, worker_ids ) {
  let n = 1001
  let data =  new Float32Array( 2 + DN / P )

  //let p_data = rapi.add_data( data )

  Promise.resolve( rapi.submit_payload_inmem( data ) ).then( pi => {

    let r1 = STENCIL_1D.robot( rapi, "robo1", worker_ids, (x,left,right) => (left+right)/2 + Math.random() )
    // let r2 = super_robot_1( rapi, "robo2", worker_ids )

    let pr = PASS.robot( rapi, "pass1", worker_ids, 1000 )

    let save = WRITE_FS.robot( rapi,"save1", worker_ids )

    let pr2 = PASS_EACH.robot( rapi, "pass2", worker_ids, 250 )
    let intersave = WRITE_FS.robot( rapi,"save2", worker_ids,"stepping" )
    //let pr = pass_robot( rapi, "pass1", worker_ids, 1000 )
    //let pr2 = pass_robot( rapi, "pass2", worker_ids, 1000 )
    //let pr3 = pass_robot( rapi, "pass3", worker_ids, 1000 )

    //console.log("r1=",r1,"pi=",pi)

    // кольцо
    LIB.create_port_link( rapi, r1.output, pr.input )
    LIB.create_port_link( rapi, pr.output, r1.input )
    LIB.create_port_link( rapi, pr.finish, save.input )

    LIB.create_port_link( rapi, r1.output, pr2.input )
    LIB.create_port_link( rapi, pr2.output, intersave.input )
    /*
    create_port_link( rapi, pr.output, pr2.input )
    create_port_link( rapi, pr2.output, pr3.input )
    create_port_link( rapi, pr3.output, r1.input )
    */

    console.time("compute")
    // начальные данные  
    r1.input.forEach( input => rapi.create_cell( input.id ).submit( {left:0, right:0, payload_info: [pi] } ) )

    // печать результата
    rapi.read_cell( pr.finish[0] ).next().then( value => {
      console.timeEnd("compute")
      console.log("finished",value)
      rapi.get_one_payload( value.payload_info[0] ).then( data => {
         console.log(data)
      })
    })

  })
  

/*
  let r = worker_ids.map( (x,index) => start_robot_1(rapi,x,{index, id:index}))
  rapi.wait_all( r ).then( channels => {
    console.log("channels=",channels)
  })
*/  
}