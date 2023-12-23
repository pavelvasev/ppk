////////////////////////////// pass
// пропускает N сигналов и больше не пропускает

export function robot( rapi, id, workers,N ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  let finish_port = workers.map( (x,index) => rapi.open_cell( `${id}/finish/${index}` ) )
  let iteration_port = workers.map( (x,index) => rapi.open_cell( `${id}/iter/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot_2( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,finish_port,iteration_port,
         N
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port, finish: finish_port, iterations:iteration_port }

  return robot
}

// finish - канал остановки
function start_robot_2( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello pass robot. args=",args)

    let {input_port, output_port, finish_port, iteration_port, index, id, count, N} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )
    let finish = rapi.create_cell( finish_port[index] )
    let iter = rapi.create_cell( iteration_port[index] )

    let f = args.f
    
    let counter = 0;
    function tick() {
      //console.log("pass begin")
      in_data.next().then( val => {
        counter++        

        //console.log("pass tick. N=",N)
        if (N-- <= 0) {
          finish.submit( val )
          return // остановка. todo: read_сell надо остановить
        }

        //Promise.resolve(true).then( () => out.submit( val ))
        // необходимо небольшое замедление ноды потому что иначе 
        // она перестает получать сообщения по вебсокетам, и tcp сокеты не открываются
        if (counter % 1024*64 == 0)
           setTimeout( () => out.submit( val ), 0 )
        else 
           out.submit( val ) // пересылаем
        tick()

        //console.log("iter submit counter",counter,"iter=",iter.id)
        iter.submit( counter ) // выдаем итерации
      })
    }

    tick()

    return true

  }, args), {runner_id}) 
}

