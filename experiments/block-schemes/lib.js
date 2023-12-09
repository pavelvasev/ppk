
  export let next_iter = arg => {

    console.log("............ hello from next_iter! arg=",arg)

    let iter_count = 0

    function get_iter_tasks(runner_id) {
      let tasks = arg.graph[ runner_id ]
      return tasks
    }

    function submit_tasks( tasks, runner_id) {      
      return tasks.map( t => {
         //console.log("submit task arg",t.arg)
         return rapi.exec( t, 
            { arg: {iter: iter_count },
              runner_id, channel_id: runner_id, output_cell: t.opts.output_cell }  ) 
      })
    }

    function enter_iter(runner_id) {
      let tasks = get_iter_tasks( runner_id )
      //console.log("TTTT tasks=",tasks)
      iter_count++
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
        //console.log("going sending finished!")
        //let r = rapi.add_data( my_data )
        //rapi.msg({label:"finished",runner_id:arg.my_id, data: cell, k: arg.k })  
        ///f_resolve( cell ) // cell это r[0] а это чухня. ну ладно пока.
        my_cell_read.next().then( x => {
           //console.log("sending finished! x=",x)
           f_resolve(x) 
         })
       }
    }

    let f_resolve
    return new Promise( (resolve,reject) => {
      f_resolve = resolve
    })
  }

  

////////////////////////////// шаблоны!

/* F-INDEX - передача индекса
   F-SCRATCH - создание данных с нуля (возможно, с доп. аргументом)
*/

// применяет указанную функцию над элементами 1-мерного блока 
// + соседи
export let f_part_call = (arg) => {
   //console.log("arg is",arg)
       let p = arg.input.payload[0]
       let f = arg.f

       //let nx = new Float32Array( p.length )
       let jmax = p.length-1
       p[ 0 ] = arg.left_block ? arg.left_block.right : 0
       p[ p.length-1 ] = arg.right_block ? arg.right_block.left : 0
       let p_left = p[0]
       let p_my   = 0
       let p_right = 0
       for (let j=1; j<jmax; j++) {
         p_my = p[j]
         p_right = p[j+1]
         p[j] = f( p_my, p_left, p_right, j-1 )
         p_left = p_my
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return {payload:[p],left:p[1], right:p[p.length-2]}
}

// применяет указанную функцию над элементами 1-мерного блока 
// без соседей
export let f_part_single_call = (arg) => {
   //console.log("arg is",arg)
       let p = arg.input.payload[0]
       let f = arg.f
       //let nx = new Float32Array( p.length )
       let jmax = p.length-1
       for (let j=1; j<jmax; j++) {
         p[j] = f(p[j],j-1)
       }
       //p_next[j] = (p[j-1] + p[j+1])/2 + Math.random(1)
       //console.log("computed",p)
       return {payload:[p],left:p[1], right:p[p.length-2]}
}

////////////////////////////////////////////////////

let ctx_counter = 1

  function get_new_id( ctx,key="id" ) {
      ctx.id ||= (ctx_counter++)
      ctx.fn_id ||= 0
      ctx.fn_id++ // это глобальный идентификатор узла (функции) - он нужен чтобы генерировать исходящие каналы           
      return `${ctx.id}_${ctx.fn_id}_${key}`
  }

  export function create_ctx( rapi, worker_ids ) {
    return { rapi, graph: {}, runners: worker_ids, fn_id: 0, id: ctx_counter++ }
  }

  // пока требование чтобы data размерность и runners - совпадали
  // вычисление по шаблону f(x,t+1) = g( f(x-1,t), f(x,t), f(x+1,t) )
  export function f_1d_borders( ctx, fn, name )
  {
    let rapi = ctx.rapi;

    if (!fn.operation_id) {
      fn.operation_id = get_new_id(ctx,name || `f_1d_borders`)
      console.log('regging operation',fn.operation_id)
      // мб не rapi.js а на вход операции просить уже тогда?
      // ну будем считать что тут автоматом конвертер покамест
      rapi.define(fn.operation_id, rapi.js( f_part_call,{f: rapi.compile_js(fn)}))
    }

    return (data) => {
      let graph = ctx.graph
      let P = data.length

      let out_cells = []
      for (let k=0; k<P; k++) {
        let cellid = get_new_id(ctx,`${k}_cell_out`)
        //console.log({cellid})
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
  // вычисление по шаблону f(x,t+1) = g( f(x,t) )
  export function f_1d( ctx, fn, name )
  {
    let rapi = ctx.rapi;

    if (!fn.operation_id) {
      fn.operation_id = get_new_id(ctx,name || `f_1d`)
      console.log('regging operation 1d',fn.operation_id)
      // мб не rapi.js а на вход операции просить уже тогда?
      // ну будем считать что тут автоматом конвертер покамест
      rapi.define(fn.operation_id, rapi.js(f_part_single_call,{f: rapi.compile_js(fn)}))
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

  // просто вызов функции когда данные готовы - поблочно  
  export function f_map_blocks( ctx, fn, name )
  {
    let rapi = ctx.rapi;

    if (!fn.operation_id) {
      fn.operation_id = get_new_id(ctx,name || `f_map_blocks`)
      console.log('regging operation f_map_blocks',fn.operation_id)
      // мб не rapi.js а на вход операции просить уже тогда?
      // ну будем считать что тут автоматом конвертер покамест
      rapi.define(fn.operation_id, rapi.js(fn) )
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


  export function start_ctx( ctx ) {
    let acc = []
    for (let runner_id of ctx.runners) {
      for (let t of ctx.graph[runner_id]) {
        //console.log("start_ctx: t=",t)
        let r = ctx.rapi.exec( t, {runner_id} )
        acc.push( r )
      }
    }
    return acc // какая-то куча каких-то результатов
  }


  export function iteration( outer_ctx, N, start_data, ctx_fn ) {

    let rapi = outer_ctx.rapi

    if (!iteration.next_iter_defined) {
        rapi.define("next_iter", rapi.js(next_iter))
        iteration.next_iter_defined = true
    }

    let ctx = create_ctx( rapi, outer_ctx.runners )
    let iteration_cells = start_data.map( x => rapi.open_cell( get_new_id(ctx) ) )
    let one_iter_res = ctx_fn( ctx, iteration_cells )
    // final_res это концовка графа - последние ячейки

    // закольцовываем граф для итераций..    
    one_iter_res.forEach( (output_cell, index) => {
      rapi.create_link( output_cell.id, iteration_cells[index].id )
    })

      // это у нас старт движка итераций... которому мы между тем передаем и граф
    //rapi.exec( rapi.operation( "next_iter",{},"js"), {arg: {N: n, my_id: worker_ids[0], data: rapi.skip_payloads(prev)}, runner_id: worker_ids[0]})
    let cnt = outer_ctx.runners.length
    let acc = []
    for (let k=0; k<cnt; k++) {

        let cellid = get_new_id(outer_ctx,`${k}_cell_out`)        
        let data_arr_next = rapi.open_cell( cellid );
        acc.push( data_arr_next )

        let iter_result = 
        rapi.operation( "next_iter",
        {          
            k: k, 
            N, 
            P : cnt,            
            iteration_cells, 
            data: start_data[k],
            graph: ctx.graph,
            my_id: ctx.runners[k],          
        }, {runner_id: ctx.runners[k], lang_env:"js", output_cell: data_arr_next})

       outer_ctx.graph[ outer_ctx.runners[k] ] ||= []
       outer_ctx.graph[ outer_ctx.runners[k] ].push( iter_result )

       //acc.push( iter_result )
     }
     // можно было бы iteration_cells.finish или типа того
     return acc
  }