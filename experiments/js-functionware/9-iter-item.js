#!/usr/bin/env -S node
// 9 - полноценный участник композиции без доп. настроек
// 8 - запуск итерации это участник композиции.
// 7 - полные шаблоны. на вход простые функции.
// 6 = генерируем функции по шаблону
// 5 - умножаем на коэффициент 0.5
// 4 - контекст передается только на вход (на выход нет необходимости выходит)
// 3 - пробуем комбинацию функций..
// 1 - матричный граф, параллельная версия, созданный функцией compute

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
import * as F from "./f.js"

function main( rapi, worker_ids ) {
  let n = 1001
  let data =  new Float32Array( DN / P )
  /*
  console.log("init data=",data)
  let prev = rapi.promises.add_data( {left:0, right:0, payload:[data]} )
  console.log("prev=",prev)
  let p_data = []
  for (let k=0; k<P; k++) p_data.push( prev )
  */
  // p_data - распределенная структура

  console.log("spawning",n)

  let next_iter = arg => {

    console.log("............ hello from next_iter! arg=",arg)

    function get_iter_tasks(runner_id) {
      let tasks = arg.graph[ runner_id ]
      return tasks
    }

    function submit_tasks( tasks, runner_id) {      
      return tasks.map( t => {
         //console.log("submit task arg",t.arg)
         return rapi.exec( t, {runner_id, channel_id: runner_id, output_cell: t.opts.output_cell }  )
      })
    }

    function enter_iter(runner_id) {
      let tasks = get_iter_tasks( runner_id )
      //console.log("TTTT tasks=",tasks)
      let submitted = submit_tasks( tasks, runner_id )
      return submitted
    }  
    
    let my_cell = rapi.create_cell( arg.iteration_cells[ arg.k ].id )
    // стартовое значение
    my_cell.submit( arg.data )

    // каналы уже закольцованы внешне
    
    // переходим в режим получения тактов
    let my_cell_read = rapi.read_cell( arg.iteration_cells[ arg.k ].id )
    make_step( arg.N, my_cell_read )

    function make_step( N, cell ) {
       if (N > 0)
       my_cell_read.next().then( () => { // это у нас локальная реакция - внешний такт         
          // в канале rr появились данные
          // и мы пошли делать задачи этого воркера
          let r = enter_iter( arg.my_id )
          // а затем перешли к следующей итерации
          //console.log('ENTER ITER r=',r)
          make_step( N-1, r[0] )
       })
       else 
       {
        console.log("sending finished!")
        //let r = rapi.add_data( my_data )
        //rapi.msg({label:"finished",runner_id:arg.my_id, data: cell, k: arg.k })  
        f_resolve( cell ) // cell это r[0] а это чухня. ну ладно пока.
       }
    }

    let f_resolve
    return new Promise( (resolve,reject) => {
      f_resolve = resolve
    })
  }
  rapi.define("next_iter", rapi.js(next_iter))

  ////////////////////////////////////

//  rapi.define("step1", rapi.js(F.f_part))
//  rapi.define("step_div", rapi.js(F.f_part_div))


  function get_new_id( ctx,key="id" ) {
      ctx.fn_id ||= 0
      ctx.fn_id++ // это глобальный идентификатор узла (функции) - он нужен чтобы генерировать исходящие каналы           
      return `${ctx.fn_id}_${key}`
  }

  // пока требование чтобы data размерность и runners - совпадали
  function f_1d_borders( ctx, fn, name )
  {
    if (!fn.operation_id) {
      fn.operation_id = get_new_id(ctx,name || `f_1d_borders`)
      console.log('regging operation',fn.operation_id)
      // мб не rapi.js а на вход операции просить уже тогда?
      // ну будем считать что тут автоматом конвертер покамест
      rapi.define(fn.operation_id, rapi.js( F.f_part_call,{f: rapi.compile_js(fn)}))
    }

    return (data) => {
      let graph = ctx.graph

      let out_cells = []
      for (let k=0; k<data.length; k++) {
        let cellid = get_new_id(ctx,`${k}_cell_out`)
        console.log({cellid})
        let data_arr_next = rapi.open_cell( cellid );
        out_cells.push( data_arr_next )

        let left_block = k > 0 ? rapi.skip_payloads( data[k-1] ) : null
        let right_block = k < P-1 ? rapi.skip_payloads( data[k+1] ) : null
        let res = rapi.operation( fn.operation_id, 
                {input: rapi.reuse(data[k]),left_block, right_block}, 
                {lang_env: "js", output_cell: data_arr_next} )
        ctx.graph[ ctx.runners[k] ] ||= []
        ctx.graph[ ctx.runners[k] ].push( res )
      }

      return out_cells
      // выдать граф задач, разбитый по раннерам
      // и в нем выделить стоки - результат
    }
  }

  // пока требование чтобы data размерность и runners - совпадали
  function f_1d( ctx, fn, name )
  {
    if (!fn.operation_id) {
      fn.operation_id = get_new_id(ctx,name || `f_1d`)
      console.log('regging operation 1d',fn.operation_id)
      // мб не rapi.js а на вход операции просить уже тогда?
      // ну будем считать что тут автоматом конвертер покамест
      rapi.define(fn.operation_id, rapi.js(F.f_part_single_call,{f: rapi.compile_js(fn)}))
    }

    return (data) => {
      let graph = ctx.graph

      let out_cells = []
      for (let k=0; k<data.length; k++) {
        let cellid = get_new_id(ctx,`${k}_cell_out`)
        console.log({cellid})
        let data_arr_next = rapi.open_cell( cellid );
        out_cells.push( data_arr_next )

        let res = rapi.operation( fn.operation_id, 
                {input: rapi.reuse(data[k])}, 
                {lang_env: "js", output_cell: data_arr_next} )
        ctx.graph[ ctx.runners[k] ] ||= []
        ctx.graph[ ctx.runners[k] ].push( res )
      }

      return out_cells
      // выдать граф задач, разбитый по раннерам
      // и в нем выделить стоки - результат
    }
  }


  //console.log("graph=",JSON.stringify(iter_graph,null," "))

  // это у нас загрузка начальных данных..
  // кстати как-то бы создать на раннерах эти каналы
  // а им уже послать..
  //let init_data = rapi.submit_payload( [data] )
  let d = rapi.add_data( {left:0, right:0,payload:[data]} )
  let p_data = []
  for (let k=0; k<P; k++) {
    p_data.push(d)
  }
  /*
  let p_data = []
  //let p_data_cells = []
  for (let k=0; k<P; k++) {
    let c = rapi.create_cell( k )
    init_data.then( pi => {
      c.submit( {left:0, right:0, payload_info:pi} ) 
    })
    p_data.push( c )
    //p_data_cells = []
  }
  */




////////////////////////////////////////////

// старый случай 1 функции
//  let res = f_1d_borders( ctx, (me,left,right) => (left + right)/2 + Math.random(1) ) ( p_data )


  function start_iteration( worker_ids, N, start_data, ctx_fn ) {
    let ctx = { graph: {}, runners: worker_ids }
    let iteration_cells = start_data.map( x => rapi.open_cell( get_new_id(ctx) ) )
    let one_iter_res = ctx_fn( ctx, iteration_cells )
    // final_res это концовка графа - последние ячейки

    // закольцовываем граф для итераций..    
    one_iter_res.forEach( (output_cell, index) => {
      rapi.create_link( output_cell.id, iteration_cells[index].id )
    })

      // это у нас старт движка итераций... которому мы между тем передаем и граф
    //rapi.exec( rapi.operation( "next_iter",{},"js"), {arg: {N: n, my_id: worker_ids[0], data: rapi.skip_payloads(prev)}, runner_id: worker_ids[0]})
    let cnt = worker_ids.length
    let acc = []
    for (let k=0; k<cnt; k++) {
       let iter_result = 
       rapi.exec( 
        rapi.operation( "next_iter",{},{lang_env:"js"}), 
        {
          arg: {
            k, N, P:cnt, my_id: worker_ids[k], iteration_cells, 
            data: start_data[k], graph: ctx.graph
          }, 
          runner_id: worker_ids[k]
        })

       acc.push( iter_result )
     }
     // можно было бы iteration_cells.finish или типа того
     return acc
  }

  let cres = start_iteration( worker_ids, n, p_data, (ctx, input) => {
    /////////////////// формируем граф вычислений итерации

    let f1 = f_1d_borders( ctx, (me,left,right) => (left + right)/2 + Math.random(1) )
    let f2 = f_1d( ctx, x => x * 0.5)

    let res1 = f1( input )
    let res2 = f1( res1 )
    let res =  f2( res2 )

    return res
  } )

  console.time("compute")

  rapi.wait_promise( rapi.when_all( cres ) ).then( computed => {
     console.timeEnd("compute")
     console.log("computed=",computed )

     let cell = rapi.read_cell( computed[0].id )
      console.log("reading cell ",cell.id)
      cell.next().then( res => {
        rapi.get_payloads( res.payload_info ).then( data_r => {
          console.log(data_r)
        })        
      })
  })

}