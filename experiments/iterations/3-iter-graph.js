#!/usr/bin/env -S node

/*
   метод итераций для графов задач

   граф задач одной итерации генерируется в функции iter_step_graph.
   
   на исполнителях запускается процесс вычисления итераций, см. next_iter.
   в аргументах он получает 
   - граф задач одной итерации
   - набор каналов с данными, которые подаются графу итерации на вход,
     и в эти же каналы граф итерации запишет свой результат
   - N количество итераций которые надо совершить     
*/

import * as PPK from "ppk"
import * as STARTER from "ppk/starter.js"
import * as F from "./f.js"

//let S = new STARTER.Slurm( "u1321@umt.imm.uran.ru" )
let S = new STARTER.Local()

let P = process.env.P ? parseInt(process.env.P) : F.P
let DN = process.env.DN ? parseInt(process.env.DN) : F.DN
console.log({DN,P})

let sys = S.start().then( (info) => {

  console.log("OK system started", info, S.url)

  return  S.start_workers( 1,P,4*10*1000,1,'-t 40 --gres=gpu:v100:1 -p v100' ).then( (statuses) => {
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

function main( rapi, worker_ids ) {
  let n = 1001
  let data =  new Float32Array( DN / P )

  console.log("spawning",n)

  // это алгоритм, который работает на исполнителях и в цикле запускает граф итерации
  let next_iter = arg => {

    function get_iter_tasks(data_arr,runner_id) {
      let tasks = arg.iter_graph[ runner_id ]
      return tasks
    }

    function submit_tasks( tasks, runner_id) {
      return tasks.map( t => rapi.exec( t, {runner_id, channel_id: runner_id, output_cell: t.opts.output_cell }  ) )
    }

    function enter_iter(data_arr,runner_id) {
      let tasks = get_iter_tasks( data_arr, runner_id )
      let submitted = submit_tasks( tasks, runner_id )
      return submitted
    }

    // rr    - канал с входными данными для задач этого исполнителя
    // arg.k - номер текущего исполнителя
    // p_data - набор каналов для графа итерации
    let rr = rapi.read_cell( arg.p_data[ arg.k ].id )

    make_step( arg.N, rr )

    function make_step( N, cell ) {
       if (N > 0)
       rr.next().then( () => {
          // получается здесь rr используется только для тактования,
          // как признак того что надо запускать задачи итерации
          // а данные из канала rr считываются по мере необходимости 
          // уже самими задачами. и в него же задачи и запишут результат.
          let r = enter_iter( arg.p_data, arg.my_id )
          make_step( N-1, r[0] )
       })
       else {
        console.log("sending finished!")
        rapi.msg({label:"finished",runner_id:arg.my_id, data: cell, k: arg.k })  
       }
    }
  }
  rapi.define("next_iter", rapi.js(next_iter))

  ////////////////////////////////////

  rapi.define("step1", rapi.js(F.f_part))

  console.time("compute")

  // порождение графа одной итерации.
  // data_arr - каналы с данными предыдущей итерации
  // data_arr_next - каналы куда записать результаты итерации
  function iter_step_graph(data_arr,data_arr_next) {

    let graph = {}

    for (let k=0; k<P; k++) {
      let left_block = k > 0 ? rapi.skip_payloads( data_arr(k-1) ) : null
      let right_block = k < P-1 ? rapi.skip_payloads( data_arr(k+1) ) : null
      let res = rapi.operation("step1", 
              {input: rapi.reuse(data_arr(k)),left_block, right_block}, 
              {lang_env: "js", output_cell: data_arr_next(k)} )
      graph[ worker_ids[k] ] = [res]
    }

    return graph;    
  }

  // строим граф одной итерации
  let iter_graph = iter_step_graph( 
      (k) => { return rapi.open_cell(k.toString()) },
      (k) => { return rapi.open_cell(k.toString()) }
  )

  //console.log("graph=",JSON.stringify(iter_graph,null," "))

  // готовим начальные данные
  let init_data = rapi.submit_payload( [data] )
  let p_data = []
  
  for (let k=0; k<P; k++) {
    let c = rapi.create_cell( k.toString() )
    init_data.then( pi => {
      c.submit( {left:0, right:0, payload_info:pi} ) 
    })
    p_data.push( c )    
  }

  // запускаем вычисление, состоящие из итераций
  // главный аргумент - граф одной итерации iter_graph
  // p_data - набор каналов с входными данными для графа итерации, 
  // и в эти же каналы граф записывает свой результат
  for (let k=0; k<P; k++)
     rapi.exec( rapi.operation( "next_iter",{},{lang_env:"js"}), 
        {arg: {k, N: n, P, my_id: worker_ids[k], p_data, iter_graph}, runner_id: worker_ids[k]})

  // ждем результаты

  let first_time = true
  rapi.query( "finished").done( (msg) => {
    if (first_time) {
      console.timeEnd("compute")
      first_time = false
      p_data.forEach( c => c.close() )
    }

    console.log("see finished",msg)

      let cell = rapi.read_cell( msg.data.id )
      console.log("reading cell ",msg.data.id)
      cell.next().then( res => {
        rapi.get_payloads( res.payload_info ).then( data_r => {
          console.log(msg.k,data_r)
          process.exit()
        })
        
      })
  })

}