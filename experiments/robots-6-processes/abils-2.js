#!/usr/bin/env -S node

// abils-2 формирует возможности - в виде функции которую вызывает основная программа.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

import * as LINK from "./robots/link.js"
import * as LINK_PULL from "./robots/link_pull.js"

import * as PASS from "./robots/pass.js"
import * as PASS_EACH from "./robots/pass_each.js"
//import * as REDUCE from "./robots/reduce.js"
import * as WRITE_FS from "./robots/write_fs.js"
import * as STENCIL_1D from "./robots/stencil_1d.js"
import * as PRINT from "./robots/print.js"
import * as MERGE from "./robots/merge.js"
import * as DOWNSAMPLE from "./robots/downsample.js"
import * as JOIN_1D from "./robots/join_1d_masked.js"

////////////////////////////////
//import * as F from "./f.js"

//let P = process.env.P ? parseInt(process.env.P) : 10
let DN = process.env.DN ? parseInt(process.env.DN) : 1000000
//console.log({DN})

function range(n) {
  let arr = []
  for (let i=0; i<n; i++) arr.push(i)
  return arr
}

// робот - встроенный представитель визуализации
// todo id это параметр вызова
function vis1( rapi, id, worker_ids ) {
  //let visr = VIS3.robot( rapi, "vis1", worker_ids )

  let target_points = 1000
  let downsample_coef = Math.ceil( DN / target_points )
  let downsample = DOWNSAMPLE.robot( rapi, id+"/downsample1", worker_ids,downsample_coef )

  let joinr = JOIN_1D.robot( rapi, id+"/j1d", worker_ids )

  //LINK.create( rapi, visr.side_output, downsample.input )
  LINK.create( rapi, downsample.output, joinr.input )

  // теперь надо что когда joinr выдал свой результат, чтобы
  // был тыркнут порт main_continue
  /*

  let cont = CONT.robot( rapi, "cont", worker_ids )
  LINK.create( rapi, visr.input, cont.input )
  LINK.create( rapi, cont.output, visr.main_continue )
  //rapi.create_link( joinr.output[0].id, visr2.control[0].id )
  // можем так. тк.. там 1-размерные
  LINK.create( rapi, joinr.output, cont.control )
  */

  //return visr
  return { input: downsample.input, output: joinr.output }
}

// calc_output - порт выхода счетной части
export function setup_visuals( rapi, worker_ids, calc_output ) {

  rapi.shared("abilities").submit({title:"График 1",msg:{label:"start_process",code:"gr1",target:"abils"}})

  let stop_process_fn = {}
  let id_counter = 0
  rapi.query("start_process").done( val => {
    console.log("see msg for start_process! val=",val)
    let id = "id_"+(id_counter++)
    let delete_fn = rapi.start( val.code, {arg: val.arg, id}, val.target)
    stop_process_fn[ id ] = delete_fn
  })

  rapi.query("stop_process").done( val => {
    console.log("see msg for stop_process! val=",val)
    stop_process_fn[ val.id ]()    
  })

  ////////////////////////
  let stop_process_fn2 = {}

  let procs = rapi.shared_list_reader("abils")
  procs.added.subscribe( val => {
    //console.log("see process request",val)
    let {code,arg} = val.value.arg // чето перебор
    console.log("see process request",val,{code,arg})

    if (code == "gr1") {
      let id = arg.id // "id_"+Math.random()
      let r = main_3( rapi, worker_ids, calc_output,id )
      stop_process_fn2[ id ] = r
    }
  })

  procs.deleted.subscribe( val => {
    console.log("see procs deleted",val)
    let process_id = val.value.arg.arg.id // фантастика
    console.log("process_id=",process_id)
    // и как мы тебя удалять будем?
    // по идее контейнер
    let fn = stop_process_fn2[ process_id ]
    if (fn) fn(); else console.error("delete: process not found")
  })

}

function main_3( rapi, worker_ids, calc_output, id ) {

  /* тема удаления.. 
     по идее надо удалять просто каждый элемент..
     или контейнера достаточно? думаю его
     ибо он создает там остальных на клиенте..
     но с другой стороны есть элементы КВ и еще есть линки
     ну стало быть формально - элементы КВ должны возвращать функцию
     или канал - для остановки. усе.
  */

  function mkid(part_id) { return id + "/"+part_id }

  let stop_fn = []
  let u

  u = rapi.shared("gr_view").submit({type:"container",id:mkid("c1")})
  stop_fn.push( u.delete )

  u = rapi.shared("gr_view").submit({type:"button",id:mkid("gr1id_b"),parent_id:mkid("c1"),
       params:{title: "Стоп", msg_on_click: {label:"stop_process", id }}})
  stop_fn.push( u.delete )

  //////////////////////////// график

  u = rapi.shared("gr_view").submit({type:"gr",id:mkid("gr1id"),parent_id:mkid("c1"),params:{sx: 10, sy: 2000}})
  stop_fn.push( u.delete )

  let gr1id = rapi.open_cell(mkid("gr1id/data"))
  let gr1id_p = rapi.create_cell(mkid("gr1id/params"))
  stop_fn.push( gr1id_p.stop.bind( gr1id_p ) )

  //////////////////////////// граф визуализации

  let visr = vis1( rapi, mkid("vis1"), worker_ids )
  console.log('connecting via pull',calc_output, visr.input)
  let lp = LINK_PULL.create( rapi, calc_output, visr.input, worker_ids, mkid("vis_lp") )
  stop_fn.push( lp.destroy )

  //////////////////////////// связь графика и графа визуализации
  u = rapi.create_link( visr.output[0], mkid("gr1id/data") )
  stop_fn.push( u.unsub )
  u = rapi.create_link( mkid("gr1id/updated"), lp.control[0] )
  stop_fn.push( u.unsub )
  console.log("visr.output[0]=",visr.output[0])

  //////////////////////////// начальный запрос

  let control_cell = rapi.create_cell( lp.control[0] )
  stop_fn.push( control_cell.stop.bind(control_cell) )
  console.log("submitting to control_cell",lp.control[0])
  control_cell.submit( 22 )
  //let data_port = rapi.read_cell( visr.output[0] ) 
  let data_port = rapi.read_cell( mkid("gr1id/data") )
  stop_fn.push( data_port.stop.bind(data_port) )

  function tick() {
    console.log("waiting data port..",data_port.id)
    data_port.next().then( value => {
      console.log("data port got next... value=",value,"from data_port.id=",data_port.id)
    })
  }
  tick()

  console.log("CCC",stop_fn)

  return () => {
    stop_fn.map( x => x() )
  }

}