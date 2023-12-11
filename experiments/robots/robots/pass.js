////////////////////////////// pass
// пропускает N сигналов и больше не пропускает

export function robot( rapi, id, workers,N ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  let finish_port = workers.map( (x,index) => rapi.open_cell( `${id}/finish/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot_2( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,finish_port,
         N
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port, finish: finish_port }

  return robot
}

// finish - канал остановки
function start_robot_2( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello robot v2. args=",args)

    let {input_port, output_port, finish_port, index, id, count, N} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )
    let finish = rapi.create_cell( finish_port[index] )

    let f = args.f
    
    let counter = 0;
    function tick() {
      in_data.next().then( val => {
        //console.log("pass-robot. N=",N)
        if (N-- <= 0) {
          finish.submit( val )
          return // остановка. todo: read_сell надо остановить
        }

        out.submit( val ) // пересылаем
        tick()       
      })
    }

    tick()

    return true

  }, args), {runner_id}) 
}

