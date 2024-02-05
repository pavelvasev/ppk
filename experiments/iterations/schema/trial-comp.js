#!/usr/bin/env -S node
/* Метод схем - алгоритм определяется блок-схемой. 
   Каждый блок этой схемы сам запускает необходимое число параллельных процессов на исполнителях.
   Блоки взаимодействуют с другими блоками посредством портов. 
   Каждый порт является группой каналов, сообразно разбиению расчётной сетки: каждому блоку сетки сопоставлен отдельный канал.
   Порты блоков можно соединять связями. Связь соединяет соответствующие каналы.
   Таким образом алгоритм вычислений, выраженный блок-схемой, определяет набор параллельных процессов и соединения между ними.
*/

import * as PPK from "ppk"
import * as SLURM from "ppk/slurm.js"
import * as LOCAL from "ppk/local.js"

// определения связей 
import * as LINK from "./robots/link.js"
import * as LINK_PULL from "./robots/link_pull.js"

// определения блоков
import * as PASS from "./robots/pass.js"
import * as PASS_EACH from "./robots/pass_each.js"
import * as DOWNSAMPLE from "./robots/downsample.js"
import * as WRITE_FS from "./robots/write_fs.js"
import * as STENCIL_1D from "./robots/stencil_1d_v2.js"
import * as PRINT from "./robots/print.js"

import * as VIS from "./robots/vis_pass.js"
import * as VIS3 from "./robots/vis_pass_3.js"
import * as JOIN_1D from "./robots/join_1d_masked.js"
//import * as CONT from "./robots/continue.js"
import * as MERGE from "./robots/merge.js"

import * as REDUCE_L from "./robots/reduce_linear.js"
import * as REDUCE_P from "./robots/reduce_par.js"
import * as MAP from "./robots/map.js"
import * as MAP2 from "./robots/map_2.js"
import * as INIT from "./robots/init.js"

let DEBUG_WORKERS= process.env.DEBUG ? true : false

// число процессов
let P = process.env.P ? parseInt(process.env.P) : 10
// число процессов в 1 job-е (слурм запускаем job-ами)
let JP = process.env.JP ? parseInt(process.env.JP) : 1
let DN = process.env.DN ? parseInt(process.env.DN) : 1000*1000

let iters = process.env.ITERS ? parseInt(process.env.ITERS) : 1001 // iters_calc
let sync_mode =  process.env.SYNC ? true : false

// сколько памяти надо 1 процессу
let MEM_PER_PROCESS = 200 + Math.ceil( ((DN / P) *4 *2) / (1024*1024) )

console.log({DN,P,iters,sync_mode,MEM_PER_PROCESS})

let S = process.env.SLURM ? new SLURM.Starter() : new LOCAL.Starter()

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

  // гипертрединг: https://hpc.nmsu.edu/discovery/slurm/hyper-threading/
  return S.start_workers( P/JP,JP,JP*MEM_PER_PROCESS,'-t 40' ).then( (statuses) => {
    //console.log("workers started",statuses)
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

// функция порождения схемы вычислений (в форме блока)
function compute1( rapi,worker_ids, n, sync ) {
  //let data =  new Float32Array( 2 + DN / P )

  //let p_data = rapi.add_data( data )

  let init = INIT.robot( rapi, "init1", worker_ids, (args,index,local_rapi) => {
    let data = new Float32Array( args.DN / args.P )
    //return { left:0, right: 0, payload: [data]}    
    return local_rapi.submit_payload_inmem( data ).then( pi => {
      return {left:0, right:0, payload_info: [pi] }
    })
  }, {DN,P})

  let r1 = STENCIL_1D.robot( rapi, "robo1", worker_ids, (x,left,right) => (left+right)/2 + Math.random() )
  let pr = PASS.robot( rapi, "pass1", worker_ids, n )

  // начальные данные
  LINK.create( rapi, init.output, r1.input )

  // кольцо
  LINK.create( rapi, r1.output, pr.input )
  LINK.create( rapi, pr.output, r1.input )

  let deployed = Promise.all( [r1.deployed, pr.deployed] )

  return {output: r1.output, final: pr.finish, deployed }
}

////////////////////////////////

function main( rapi, worker_ids ) {
  console.log("main called")
  
  let c1 = compute1( rapi, worker_ids, iters, sync_mode)

  // ведем подсчет с момента когда роботы развернуты
  Promise.all( [c1.deployed] ).then( () => {

    console.log("robots spawned. waiting finish")
    console.time("compute")

    // печать результата
    let t0 = performance.now()
    let data_promises = c1.final.map( x => rapi.read_cell( x ).next() )
   
    Promise.all( data_promises ).then( value => {
      let tdiff = performance.now()-t0
      console.timeEnd("compute")
      
      let fps = 1000*iters / tdiff
      let mps = fps * DN / 1000000
      console.error("P=",P,"DN=",DN,"JP=",JP,"iters=",iters, "seconds=",tdiff / 1000, "fps=",fps,"mps=", mps, "mps_per_runner=",mps / P)
      
      rapi.get_one_payload( value[0].payload_info[0] ).then( data => {
         console.log(data)
         process.exit(0)
      })
      
    })

  })


}
