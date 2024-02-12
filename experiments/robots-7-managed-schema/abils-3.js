#!/usr/bin/env -S node

// abils-3 формирует возможности - в виде функции которую вызывает основная программа.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

import * as LINK from "./robots/link.js"
//import * as LINK_PULL from "./robots/link_pull.js"
import * as VIS_PASS from "./robots/vis_pass_5.js"

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

export function link_process( rapi, id, worker_ids ) 
{

  function mkid(part_id) { return id + "/"+part_id }

  let stop_fn = []
  let u
  let container_id = mkid("c1")

  u = rapi.shared("gr_view").submit({type:"container",id:container_id})
  stop_fn.push( u.delete ) // todo idea сделать функцию добавления в массив этот

  let input = [ ["--",""] ]

  u = rapi.shared(container_id).submit({type:"combobox",id:mkid("src"),
       params:{title: "Источник",input}})  
  stop_fn.push( u.delete )

  u = rapi.shared(container_id).submit({type:"combobox",id:mkid("tgt"),
       params:{title: "Приёмник",input}})  
  stop_fn.push( u.delete )

  /////////////////////////

  // передаем в гуи варианты ссылок
  let src_input_cell = rapi.create_cell(mkid("src/input"))
  let tgt_input_cell = rapi.create_cell(mkid("tgt/input"))

  let ports = rapi.shared_list_reader("ports")
  let ports_values = []
  let ports_values_map = {}

  ports.changed.subscribe( val => {
    console.log("link see ports change:",val)
    ports_values = val

    input = [ ["--",""] ].concat( val.map( (val) => {
      return [ [val.id,val.id]]
    }).flat(1) )

    ports_values_map = {}
    val.forEach( val => ports_values_map[ val.id] = val.channels )    

    src_input_cell.submit( input )
    tgt_input_cell.submit( input )
    
  })

  ///////////////////////// получаем из гуи

  let selected_src = rapi.read_cell( mkid("src/value") )
  stop_fn.push( selected_src.stop.bind(selected_src) )
  let selected_tgt = rapi.read_cell( mkid("tgt/value") )
  stop_fn.push( selected_tgt.stop.bind(selected_tgt) )

      // публикуем наружу
      let selected_src2 = rapi.create_cell( mkid("src/value_mon") )
      stop_fn.push( selected_src2.stop.bind(selected_src2) )
      let selected_tgt2 = rapi.create_cell( mkid("tgt/value_mon") )
      stop_fn.push( selected_tgt2.stop.bind(selected_tgt2) )

  let selected_src_value
  let selected_tgt_value
  let link

  function thus_update_link() {
    if (link)
      link.destroy()
    link = null
    console.log("thus_update_link",selected_src_value, selected_tgt_value)
    if (selected_src_value && selected_tgt_value) {
      console.log("thus creating")
      link = LINK.create( rapi, selected_src_value, selected_tgt_value, true ) 
    }
  }
  stop_fn.push( () => link ? link.destroy(): 1 )

  function tick() {
    selected_src.next().then( value => {
      console.log("link src =",value)      
      selected_src_value = ports_values_map[value] //ports_values[ value-1 ]?.channels 
      selected_src2.submit( value )
      thus_update_link()
      tick()
    }, () => {})
  }
  tick()  

  function tick2() {
    selected_tgt.next().then( value => {
      console.log("link tgt =",value)
      selected_tgt_value = ports_values_map[value] //ports_values[ value-1 ]?.channels
      selected_tgt2.submit( value )
      //console.log( {ports_values, value, selected_tgt_value})
      thus_update_link()
      tick2()
    }, () => {})
  }
  tick2()

  return { stop: () => {
    stop_fn.map( (x,index) => {
      //console.log("stop_fn calling x",x, index)
      x()
    } )
  }}
}


export function main_3( rapi, id, worker_ids ) {

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
  let container_id = mkid("c1")

  u = rapi.shared("gr_view").submit({type:"container",id:container_id})
  stop_fn.push( u.delete ) // todo idea сделать функцию добавления в массив этот

  u = rapi.shared(container_id).submit({type:"button",id:mkid("gr1id_b"),
       params:{title: "Стоп", msg_on_click: {label:"stop_process", id }}})
  stop_fn.push( u.delete )

  //////////////////////////// график

  u = rapi.shared(container_id).submit({type:"gr",id:mkid("gr1id"),params:{sx: 10, sy: 2000}})
  stop_fn.push( u.delete )

  let gr1id = rapi.open_cell(mkid("gr1id/data"))
  let gr1id_p = rapi.create_cell(mkid("gr1id/params"))
  stop_fn.push( gr1id_p.stop.bind( gr1id_p ) )

  //////////////////////////// граф визуализации

  let visr = vis1( rapi, mkid("vis1"), worker_ids )
  //console.log('connecting via pull',calc_output, visr.input)

  // идея. может быть LINK_PULL это тоже робот. ну обычный.
  //  и сообразно у него есть вход. и вот к этому входу уже при необходимости
  //  добавляется обычная ссылка. видимо так это должно быть.
  //let lp = LINK_PULL.create( rapi, calc_output, visr.input, worker_ids, mkid("vis_lp") )
  //stop_fn.push( lp.destroy )

  let lp = VIS_PASS.robot( rapi, mkid("vis_lp"), worker_ids)
  stop_fn.push( lp.stop )

  u = LINK.create( rapi, lp.output, visr.input )
  stop_fn.push( u.destroy )

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
    }, () => {})
  }
  tick()

  //console.log("CCC",stop_fn)

  return { input: lp.input, stop: () => {
    stop_fn.map( (x,index) => {
      //console.log("stop_fn calling x",x, index)
      x()
    } )
  } }

}