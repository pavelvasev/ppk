#!/usr/bin/env -S node
// 1 - первая попытка роботов. они же акторы. они же штуки которые деплоятся на воркерах. 
//     пока без суперроботов

// далее сильное упрощение по ссылкам на структуры данных. 
// считается что массив упрощенный.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

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
  let data =  new Float32Array( DN / P )
  
  super_robot_1( rapi, "robo1", worker_ids )
  super_robot_1( rapi, "robo2", worker_ids )

/*
  let r = worker_ids.map( (x,index) => start_robot_1(rapi,x,{index, id:index}))
  rapi.wait_all( r ).then( channels => {
    console.log("channels=",channels)
  })
*/  
}

function super_robot_1( rapi, id, workers ) {
  let input_port = workers.map( (x,index) => rapi.read_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.read_cell( `${id}/output/${index}` ) )
  
  let r = workers.map( (x,index) => start_robot_1(rapi,x,{index, id:`${id}/${index}`}))
  rapi.wait_all( r ).then( channels => {
    console.log("super_robot ",id," ready. subrobot channels=",channels)
  })  

  let robot = {}

  return robot
}

// todo канал остановки добавить
function start_robot_1( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello robot v1. args=",args)

    let in_data = rapi.read_cell(`${args.id}/in`)
    let left = rapi.read_cell(`${args.id}/left`)
    let right = rapi.read_cell(`${args.id}/right`)

    let out = rapi.create_cell(`${args.id}/out`)
    
    function tick() {
     Promise.all( [in_data.next(), left.next(), right.next()] ).then( vals => {
       console.log("tick data! valus=",vals)
     }).then( tick )
    }

    //console.log("io=",{in,out})

    return {in_data, left, right, out}

  }, args), {runner_id}) 
}