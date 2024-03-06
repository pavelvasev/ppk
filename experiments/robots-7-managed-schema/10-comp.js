#!/usr/bin/env -S node
// 10-comp абстрагировано создание главного графа. возвращаем идею что скрипт пользователя это управляющий процесс (над графом, гуем и т.п)
// 8-comp граф визуализации возвращен в счетный скрипт, но запускается как процесс из визуализатора.
// 7-comp граф визуализации сделан что запускается внешним образом.
// 6-comp сделана пулл-ссылка вместо vis-робота между выч графом и графом визуализации
// 5-comp добавлена редукция данных для визуализации
// 3-comp с роботом начальных данных.
// 2-comp новый метод подсчета итераций. с "планированием времени"
// 1-comp-sync = 8-comp из robots-2 с флагом нужна ли синхронизация

import * as PPK from "ppk"
import * as SLURM from "ppk/slurm.js"
import * as LOCAL from "ppk/local.js"

import * as LINK from "./robots/link.js"
//import * as LINK_PULL from "./robots/link_pull.js"
import * as PASS from "./robots/pass.js"
import * as PASS_EACH from "./robots/pass_each.js"
import * as DOWNSAMPLE from "./robots/downsample.js"
import * as WRITE_FS from "./robots/write_fs.js"
import * as STENCIL_1D from "./robots/stencil_1d_v2.js"
import * as PRINT from "./robots/print.js"

//import * as VIS from "./robots/vis_pass.js"
//import * as VIS3 from "./robots/vis_pass_3.js"
import * as JOIN_1D from "./robots/join_1d_masked.js"
//import * as CONT from "./robots/continue.js"
import * as MERGE from "./robots/merge.js"

import * as REDUCE_L from "./robots/reduce_linear.js"
import * as REDUCE_P from "./robots/reduce_par.js"
import * as MAP from "./robots/map.js"
import * as MAP2 from "./robots/map_2.js"
import * as INIT from "./robots/init.js"

import * as ABILITIES from "./abils-3.js"
import * as GR5 from "ppk/gr5.js"
import * as GRA from "ppk/graph.js"

let DEBUG_WORKERS= process.env.DEBUG ? true : false

//PPK.mk_console_verbose( process.env.VERBOSE )

// число процессов
let P = process.env.P ? parseInt(process.env.P) : 10
// число процессов в 1 job-е (слурм запускаем job-ами)
let JP = process.env.JP ? parseInt(process.env.JP) : 1
let DN = process.env.DN ? parseInt(process.env.DN) : 1000*1000

let plained_seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 20*60 // время работы "планируемое"
//let CP = P == 1 ? 100 : P== 2 ? 150 : P==4 ? 200 : 500 // ожидаемая производительность
//let CP = P <= 4 ? 250 : 500 // ожидаемая производительность
let CP= P == 1 ? 100 : 500
let iters_calc = Math.max( 5, Math.round( plained_seconds * CP * 1000000 / DN ) )
// секунды = (DN/10^6) * iters / CP; где CP это ожидаемая производительность
// => iters = секунды * CP * 10^6 / DN

let iters = process.env.ITERS ? parseInt(process.env.ITERS) : iters_calc
let sync_mode =  process.env.SYNC ? true : true // false 

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
  // гипертрединг: https://hpc.nmsu.edu/discovery/slurm/hyper-threading/
  return S.start_workers( P/JP,JP,JP*MEM_PER_PROCESS,'-t 40', DEBUG_WORKERS ).then( (statuses) => {
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

/*
function define_subprocess_types( rapi ) {
  let f = ( rapi,id,args, worker_ids) => {
    return import("./robots/init.js").then( m => {
      m.robot( rapi,id, worker_ids, arg.fn, arg )
    })
  }

  rapi.define( "init",f )

  let f2 = ( rapi,id,args, worker_ids) => {
    return import(`./robots/${id}`).then( m => {
      return m.robot( rapi,id, worker_ids, arg.fn, arg )
    })
  }

  let f2s = f2.toString()

  rapi.query("type_request",(msg) => {
    rapi.reply( msg,f2s )
  })
}
*/

function compute2( rapi, id, args, worker_ids ) {

  // rapi, имя графа, id префикса!
  let g = GRA.open_graph( rapi, "pr_list", id)

  let init = g.create_process("init",{worker_ids, DN, P,
     fn: (args,index,local_rapi) => {
    let data = new Float32Array( args.DN / args.P )
    //return { left:0, right: 0, payload: [data]}    
    return local_rapi.submit_payload_inmem( data ).then( pi => {
      return {left:0, right:0, payload_info: [pi] }
    })
  }})

  //let r1 = STENCIL_1D.robot( rapi, mkid("robo1"), worker_ids, (x,left,right) => (left+right)/2 + Math.random() )

  let r1 = g.create_process( "stencil-1d", {worker_ids, DN, P,
      fn: (x,left,right) => (left+right)/2 + Math.random()
      })

  let pr = g.create_process("pass",{worker_ids, n: args.n} )

  g.create_link( init.port("output"), r1.port("input") )

  g.create_link( r1.port("output"), pr.port("input") )
  g.create_link( pr.port("output"), r1.port("input") )

  return g.make_process()
  // напрашивается: return g
  // где g это subprocess некий, а не то что граф.. ммм.
}

////////////////////////////////

function types_func(classname) {

  let fallback = GRA.shared_def_reader( rapi )

  return import(`./robots2/${classname}.js`).then( m => {
      return {value: m.macro}
  },err => {
    return fallback( classname )
  })
}


function main( rapi, worker_ids ) {
  console.log("main called")

  GRA.setup_process_engine( rapi, "pr_list", types_func, worker_ids)
  rapi.define("compute", compute2 )

  //setup_process_engine( rapi, worker_ids, table )

  // todo это вычислимо из tablica
  rapi.shared("abilities").submit({title:"Вычисление",msg:{label:"start_process",type:"compute",target:"pr_list"}})
  rapi.shared("abilities").submit({title:"График",msg:{label:"start_process",type:"vis",target:"pr_list"}})
  rapi.shared("abilities").submit({title:"Счетчик",msg:{label:"start_process",type:"show_iters",target:"pr_list"}})  
  rapi.shared("abilities").submit({title:"Связь",msg:{label:"start_process",type:"link_process",target:"pr_list"}})  
  
  //let stop = rapi.start_process("compute",{},"pr_list","compute1")

  // запускаем встроенный визуализатор
  GR5.start()

  console.log("schema engine spawned.");

}