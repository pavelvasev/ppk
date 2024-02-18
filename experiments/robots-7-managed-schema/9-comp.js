#!/usr/bin/env -S node
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

// формально и это может выдавать робота. почему нет. оно как бы такое и есть.
// надо ток сигнатуру с полями - макро-портами.
function compute1( rapi, id, worker_ids, n, sync ) {
  //let data =  new Float32Array( 2 + DN / P )

  function mkid(part_id) { return id + "/"+part_id }  

  //let p_data = rapi.add_data( data )

  let init = INIT.robot( rapi, mkid("init1"), worker_ids, (args,index,local_rapi) => {
    let data = new Float32Array( args.DN / args.P )
    //return { left:0, right: 0, payload: [data]}    
    return local_rapi.submit_payload_inmem( data ).then( pi => {
      return {left:0, right:0, payload_info: [pi] }
    })
  }, {DN,P})

  let r1 = STENCIL_1D.robot( rapi, mkid("robo1"), worker_ids, (x,left,right) => (left+right)/2 + Math.random() )
  let pr = PASS.robot( rapi, mkid("pass1"), worker_ids, n )

  // нач данные
  LINK.create( rapi, init.output, r1.input )

  //console.log( pr.iterations )

  // кольцо
  /*
  LIB.create_port_link( rapi, r1.output, pr.input )
  LIB.create_port_link( rapi, pr.output, r1.input )
  */
  
  //LINK.create( rapi, r1.output, vis_robot.input )
  //LINK.create( rapi, vis_robot.output, pr.input )

  LINK.create( rapi, r1.output, pr.input )
  
  if (!sync) {
     LINK.create( rapi, pr.output, r1.input )
  }
  else 
  {  // синхронизация кольца
    // перспектива
    //let j1 = LIB.create_port_join( rapi, pr.output, merge1.output )
    //LIB.create_port_link( rapi, j1.output, r1.input )

    let merge1 = REDUCE_P.robot( rapi,mkid("iters"), worker_ids,(vals,counter) => counter )
    LINK.create( rapi, pr.iterations, merge1.input )

    let sync = MAP2.robot( rapi,mkid("sync"), worker_ids, (vals) => vals[0] )
    LINK.create( rapi, pr.output, sync.input ) 
    LINK.create( rapi, merge1.output, sync.input2, true ) 
    LINK.create( rapi, sync.output, r1.input, true ) 
  }

  let deployed = Promise.all( [r1.deployed, pr.deployed] )

  return {output: r1.output, final: pr.finish, deployed }
}

////////////////////////////////
//import * as F from "./f.js"

  let table= { 
    compute: {
      title: "Вычисление",
      fn: (rapi, id, worker_ids) => compute1( rapi, id, worker_ids, iters, sync_mode),
      ports: []}, 
    vis: { 
      title: "График",
      fn: ABILITIES.main_3,
      ports: {} },
    link_process: { 
      title: "Связь",
      fn: ABILITIES.link_process, ports: {} } 
  }


function main( rapi, worker_ids ) {
  console.log("main called")

  setup_process_engine( rapi, worker_ids, table)

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

// calc_output - порт выхода счетной части
// но вообще говоря - просто уметь создавать процессы в любом клиенте
// уже это обсуждалось. но с другой стороны - важен контекст, нельзя создавать абы как абы где
export function setup_process_engine( rapi, worker_ids,process_types_table = {} ) 
{
  //rapi.shared_list_writer

  // rapi.shared("abilities").submit({title:"График 1",msg:{label:"start_process",type:"gr1",target:"abils"}})

  /// msg api

  let stop_process_fn = {}
  let id_counter = 0
  rapi.query("start_process").done( val => {
    console.log("see msg for start_process! val=",val)
    let id = val.id || val.type + "_"+(id_counter++)
    let delete_fn = rapi.start_process( val.type, val.arg, val.target || "pr_list", id)
    stop_process_fn[ id ] = delete_fn
  })

  // todo надо обобщить. т.е. управлять прямо списком бы..
  rapi.query("stop_process").done( val => {
    console.log("see msg for stop_process! val=",val)
    let f1 = stop_process_fn[ val.id ]
    if (f1) { f1(); return }
    // F-EXTERNAL-REMOVE
    // ок размещали не мы
    procs.list.then( (list_object) => {
      console.log("RRR=",list_object.records)
      for (let n of list_object.records.keys()) {        
        let rec = list_object.records.get(n)
        console.log(rec.arg.id,val.id)
        if (rec.arg.id == val.id) {
          // наш клиент
          console.log("TGT=",n)
          rapi.shared_list_writer( "pr_list",{id:n}).delete()
          break;
        }
      }
    })
    //let active_procs = procs.changed.get()
    //console.log({active_procs})
  })

  //////////////////////// list api
  let stop_process_fn2 = {}

  let procs = rapi.shared_list_reader("pr_list")

  function start_process( record ) {
    //console.log("see process request",val)
    let {type,arg,id} = record 
    console.log("pr_list: see process request",{type,arg,id})

    id ||= type + "_p_"+(id_counter++)
    let fn = process_types_table[ type ].fn

    if (!fn) {
      console.error("process start funciton not found for type",fn)
      return
    }

    let r = fn( rapi, id, worker_ids, arg )

    if (!r.stop) {
      console.error("no stop record for type ",type)
      r.stop = () => {}
    }

    // публикуем порты созданного процесса
    let stop_publish_ports = publish_ports( rapi, id, r )

    stop_process_fn2[ id ] = () => {
      //console.log('stop_process_fn2',id)
      r.stop(); stop_publish_ports(); delete stop_process_fn2[ id ] }    
  }

  // начальные значения F-SPAWN-ON-START
  procs.loaded.once( initial_values => {
    console.log("pr_list loaded:",initial_values)
    for (let val of initial_values)
      start_process( val )
  })

  procs.added.subscribe( val => {
    start_process( val.value.arg ) // чето перебор
  })

  procs.deleted.subscribe( val => {
    console.log("pr_list procs: see procs deleted from list",val)
    let process_id = val.value.arg.id // фантастика
    //console.log("process_id=",process_id)
    // и как мы тебя удалять будем?
    // по идее контейнер
    let fn = stop_process_fn2[ process_id ]
    if (fn) fn(); else console.error("delete: process not found")
  })

}

function publish_ports( rapi, id, ports_record ) {
  let stop_arr = []

  for (let k in ports_record) {
    let r = ports_record[k]
    if (Array.isArray(r)) {
      console.log("found port:",id+"/"+k,r)
      // id: id-процесса / порт
      // channels: перечень каналов 
      let unsub = rapi.shared_list_writer("ports").submit({id:id+"/"+k,channels:r})
      stop_arr.push( unsub.delete )      
    }
  }

  return () => {
    stop_arr.map( (x,index) => {
      //console.log("stop_fn calling x",x, index)
      x()
    } )
  }
}
