#!/usr/bin/env -S node
// 4 - контекст передается только на вход (на выход нет необходимости выходит)
// 3 - пробуем комбинацию функций..
// 1 - матричный граф, параллельная версия, созданный функцией compute

// далее сильное упрощение по ссылкам на структуры данных. 
// считается что массив упрощенный.

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()
let DEBUG_WORKERS=false

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

    // закольцовываем каналы

    
    // переходим в режим получения тактов
    let rr = rapi.read_cell( arg.p_data[ arg.k ].id )
    make_step( arg.N, rr )

    function make_step( N, cell ) {
       if (N > 0)
       rr.next().then( () => { // это у нас локальная реакция - внешний такт 
          // в канале rr появились данные
          let r = enter_iter( arg.my_id )
          //console.log('ENTER ITER r=',r)
          make_step( N-1, r[0] )
       })
       else {
        console.log("sending finished!")
        //let r = rapi.add_data( my_data )
        rapi.msg({label:"finished",runner_id:arg.my_id, data: cell, k: arg.k })  
       }
    }
  }
  rapi.define("next_iter", rapi.js(next_iter))

  ////////////////////////////////////

  rapi.define("step1", rapi.js(F.f_part))

  console.time("compute")

  // пока требование чтобы data размерность и runners - совпадали
  function generate_graph_1( ctx,data )
  {
    let graph = ctx.graph
    
    ctx.fn_id ||= 0
    ctx.fn_id++ // это глобальный идентификатор узла (функции) - он нужен чтобы генерировать исходящие каналы

    let out_cells = []
    for (let k=0; k<data.length; k++) {
      let data_arr_next = rapi.open_cell(`gg${ctx.fn_id}_${k}`);
      out_cells.push( data_arr_next )

      let left_block = k > 0 ? rapi.skip_payloads( data[k-1] ) : null
      let right_block = k < P-1 ? rapi.skip_payloads( data[k+1] ) : null
      let res = rapi.operation("step1", 
              {input: rapi.reuse(data[k]),left_block, right_block}, 
              {lang_env: "js", output_cell: data_arr_next} )
      ctx.graph[ ctx.runners[k] ] ||= []
      ctx.graph[ ctx.runners[k] ].push( res )
    }

    return out_cells
    // выдать граф задач, разбитый по раннерам
    // и в нем выделить стоки - результат
  }

  //console.log("graph=",JSON.stringify(iter_graph,null," "))

  // это у нас загрузка начальных данных..
  // кстати как-то бы создать на раннерах эти каналы
  // а им уже послать..
  let init_data = rapi.submit_payload( [data] )
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

  let ctx = { graph: {}, runners: worker_ids }

  let res1 = generate_graph_1( ctx, p_data )
  let res = generate_graph_1( ctx,res1 )

  // закольцовываем граф для итераций..
  res.forEach( (output_cell, index) => {
    rapi.create_link( output_cell.id, p_data[index].id )
  })

  // это у нас старт движка итераций... которому мы между тем передаем и граф
  //rapi.exec( rapi.operation( "next_iter",{},"js"), {arg: {N: n, my_id: worker_ids[0], data: rapi.skip_payloads(prev)}, runner_id: worker_ids[0]})
  for (let k=0; k<P; k++)
       rapi.exec( rapi.operation( "next_iter",{},{lang_env:"js"}), 
        {arg: {k, N: n, P, my_id: worker_ids[k], p_data, graph: ctx.graph}, runner_id: worker_ids[k]})
  

/*
  worker_ids.forEach( runner_id => {
    rapi.exec( rapi.js( (args) => {
      console.log("sending rapi msg of start-iter",args)
      rapi.msg( {label:"start-iter", N: args.N} )
    }), {arg:{N: n}, runner_id})
  })*/

  //console.log("done. prev=",prev)

  let first_time = true
  rapi.query( "finished").done( (msg) => {
    if (first_time) {
      console.timeEnd("compute")
      first_time = false
      p_data.forEach( c => c.close() )
    }

    console.log("see finished",msg)

    //if (msg.k == 0) {
      let cell = rapi.read_cell( msg.data.id )
      console.log("reading cell ",msg.data.id)
      cell.next().then( res => {
        rapi.get_payloads( res.payload_info ).then( data_r => {
          console.log(msg.k,data_r)
        })
        
      })
    //}
    /*
    rapi.get_data( msg.data ).then( p => {
      console.log(p) 
      //rapi.exit()
    })*/
  })

/*
  rapi.wait_promise( prev ).then( res => {
    console.timeEnd("compute")
    console.log("done!",res)
    rapi.get_data( prev ).then( p => {
      console.log(p) 
      //rapi.exit()
    })    
  })
*/  
}