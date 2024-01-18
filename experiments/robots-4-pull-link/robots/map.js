// преобразование значений блоков

export function robot( rapi, id, workers,f ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot_1( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,
         f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port }

  return robot
}

// todo канал остановки добавить
function start_robot_1( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello map robot. args=",args)

    let {input_port, output_port, index, id, count, f} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell(output_port[index])    
    
    let counter = 0;
    function tick() {

      in_data.next().then( me => {
        let result = f( me, index, counter++ ) // мб еще состояние добавить уж?

        if (result.then) {
          return result.then( data => {
            return out.submit( acc )
          })
        } else
        return out.submit( result )
        // todo возможно можно и не ждать отправки - оптимизация будет
      }).then( tick )
    }

    tick()

    return true

  }, args), {runner_id})
}
