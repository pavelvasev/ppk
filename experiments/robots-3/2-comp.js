#!/usr/bin/env -S node
// 2-comp новый метод подсчета итераций. с "планированием времени"
// 1-comp-sync = 8-comp из robots-2 с флагом нужна ли синхронизация

import * as PPK from "ppk"
import * as SLURM from "ppk/slurm.js"
import * as LOCAL from "ppk/local.js"

import * as LIB from "./robots/lib.js"
import * as PASS from "./robots/pass.js"
import * as PASS_EACH from "./robots/pass_each.js"
import * as REDUCE from "./robots/reduce.js"
import * as WRITE_FS from "./robots/write_fs.js"
import * as STENCIL_1D from "./robots/stencil_1d.js"
import * as PRINT from "./robots/print.js"

import * as VIS from "./robots/vis_pass.js"
import * as VIS3 from "./robots/vis_pass_3.js"
import * as JOIN_1D from "./robots/join_1d_masked.js"
import * as CONT from "./robots/continue.js"
import * as MERGE from "./robots/merge.js"

import * as REDUCE_L from "./robots/reduce_linear.js"
import * as REDUCE_P from "./robots/reduce_par.js"
import * as MAP from "./robots/map.js"
import * as MAP2 from "./robots/map_2.js"

let DEBUG_WORKERS= process.env.DEBUG ? true : false

// число процессов
let P = process.env.P ? parseInt(process.env.P) : 10
// число процессов в 1 job-е (слурм запускаем job-ами)
let JP = process.env.JP ? parseInt(process.env.JP) : 1
let DN = process.env.DN ? parseInt(process.env.DN) : 1000*1000

let plained_seconds = 20 // время работы "планируемое"
//let CP = P == 1 ? 100 : P== 2 ? 150 : P==4 ? 200 : 500 // ожидаемая производительность
//let CP = P <= 4 ? 250 : 500 // ожидаемая производительность
let CP= P == 1 ? 100 : 500
let iters_calc = Math.max( 5, Math.round( plained_seconds * CP * 1000000 / DN ) )
// секунды = (DN/10^6) * iters / CP; где CP это ожидаемая производительность
// => iters = секунды * CP * 10^6 / DN

let iters = process.env.ITERS ? parseInt(process.env.ITERS) : iters_calc
let sync_mode =  process.env.SYNC ? true : false

// сколько памяти надо 1 процессу
let MEM_PER_PROCESS = 200 + Math.ceil( ((DN / P) *4 *2) / (1024*1024) )

console.log({DN,P,iters,sync_mode,MEM_PER_PROCESS})

let S = process.env.SLURM ? new SLURM.Starter() : new LOCAL.Starter()
//let S = new STARTER.Local()
//let S = new STARTER.Slurm()

//process.exit()

if (DN % P != 0) {
  console.error(`DN % P != 0 = ${DN % P}. DN=${DN} P=${P}`)
  process.exit(1)
}

if (P % JP != 0) {
  console.error(`P % JP != 0 = ${P % JP}. JP=${JP} P=${P}`)
  process.exit(1)
}

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  //return S.start_workers( 1,P,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100',DEBUG_WORKERS ).then( (statuses) => {
  //return S.start_workers( P,1,4*1000,1,'-t 40',DEBUG_WORKERS ).then( (statuses) => {
  return S.start_workers( P/JP,JP,JP*MEM_PER_PROCESS,1,'-t 40',DEBUG_WORKERS ).then( (statuses) => {
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
      console.log("found workers", workers, "passing to main");
      main( rapi, workers.map( w => w.id ) )
    });
  
})

// формально и это может выдавать робота. почему нет. оно как бы такое и есть.
// надо ток сигнатуру с полями - макро-портами.
function compute1( rapi,worker_ids, n, vis_robot,sync ) {
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
  
  if (!sync) {
  LIB.create_port_link( rapi, pr.output, r1.input )
  }
  else 
  {  // синхронизация кольца
  // перспектива
  //let j1 = LIB.create_port_join( rapi, pr.output, merge1.output )
  //LIB.create_port_link( rapi, j1.output, r1.input )

  let merge1 = REDUCE_P.robot( rapi,"iters", worker_ids,(vals,counter) => counter )
  LIB.create_port_link( rapi, pr.iterations, merge1.input )

  let sync = MAP2.robot( rapi,"sync", worker_ids, (vals) => vals[0] )
  LIB.create_port_link( rapi, pr.output, sync.input ) 
  LIB.create_port_link( rapi, merge1.output, sync.input2, true ) 
  LIB.create_port_link( rapi, sync.output, r1.input, true ) 
  }

  Promise.resolve( rapi.submit_payload_inmem( data ) ).then( pi => {
    // начальные данные  
    r1.input.forEach( input => rapi.create_cell( input.id ).submit( {left:0, right:0, payload_info: [pi] } ) )
  })

  return {output: r1.output, final: pr.finish}
}

// робот - встроенный представитель визуализации
function vis1( rapi,worker_ids ) {
  let visr = VIS3.robot( rapi, "vis1", worker_ids )

  let joinr = JOIN_1D.robot( rapi, "j1d", worker_ids )

  LIB.create_port_link( rapi, visr.side_output, joinr.input )

  // теперь надо что когда joinr выдал свой результат, чтобы
  // был тыркнут порт main_continue   

  let cont = CONT.robot( rapi, "cont", worker_ids )
  LIB.create_port_link( rapi, visr.input, cont.input )
  LIB.create_port_link( rapi, cont.output, visr.main_continue )
  //rapi.create_link( joinr.output[0].id, visr2.control[0].id )
  // можем так. тк.. там 1-размерные
  LIB.create_port_link( rapi, joinr.output, cont.control )

  return visr
}

////////////////////////////////
//import * as F from "./f.js"

function main( rapi, worker_ids ) {
  console.log("main called")

  let visr = vis1( rapi, worker_ids )

  //let iters = 1001*3;
  let c1 = compute1( rapi, worker_ids, iters, visr, sync_mode)

  //console.log("compute ports are ",c1)
  //console.log("visr.control is",visr.control,"visr.vis is",visr.vis)

  // vis1( rapi, worker_ids, output[0], "part-0" )

  console.log("robots spawned. waiting finish")
  console.time("compute")

  // печать результата
  let t0 = performance.now()
  rapi.read_cell( c1.final[0] ).next().then( value => {
    let tdiff = performance.now()-t0
    console.timeEnd("compute")
    console.log("finished",value)
    let fps = 1000*iters / tdiff
    let mps = fps * DN / 1000000
    console.error("P=",P,"DN=",DN,"JP=",JP,"iters=",iters, "seconds=",tdiff / 1000, "fps=",fps,"mps=", mps, "mps_per_runner=",mps / P)
    process.exit(0)
  /*  
    rapi.get_one_payload( value.payload_info[0] ).then( data => {
       console.log(data)
    })
    */
    
  })


}