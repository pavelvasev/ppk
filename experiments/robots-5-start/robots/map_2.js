// преобразование значений блоков из двух каналов в один канал

export function robot( rapi, id, workers,f ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let input_port2 = workers.map( (x,index) => rapi.open_cell( `${id}/input2/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot_1( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,input_port2,
         f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, input2: input_port2, output: output_port }

  return robot
}

// todo канал остановки добавить
function start_robot_1( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello map2 robot. args=",args)

    let {input_port, output_port, input_port2, index, id, count, f} = args

    let in_data = rapi.read_cell( input_port[index] )
    let in_data2 = rapi.read_cell( input_port2[index] )
    let out = rapi.create_cell(output_port[index])    
    
    let counter = 0;
    function tick() {
      //console.log("map2 robot waiting 2 cells")
      let p1 = in_data.next()
      let p2 = in_data2.next()
      //p1.then( () => console.log("cell 1 arrived "))
      //p2.then( () => console.log("cell 2 arrived "))
      Promise.all( [p1,p2] ).then( vals => {        
        //console.log("map2 robot got 2 vals",vals)
        let result = f( vals, index, counter++ ) // мб еще состояние добавить уж?

        if (result.then) {
          return result.then( data => {
            //console.log("map2 robot submitting output after promise")
            return out.submit( data )
          })
        } else
        //console.log("map2 robot submitting output")
        return out.submit( result )
        // todo возможно можно и не ждать отправки - оптимизация будет
      }).then( tick )
    }

    tick()

    return true

  }, args), {runner_id})
}
