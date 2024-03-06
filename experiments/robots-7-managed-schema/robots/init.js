// порождение каналов
// но вообще то не порождение а начальные данные.
// produce? init!
// arg?

export function robot( rapi, id, workers, f, f_arg ) {
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot_1( rapi,x,
       { index, id:`${id}/${index}`,
         output_port,count,f_arg,
         f:rapi.compile_js(f)
       }))

  let robot = { output: output_port }

  return robot
}

// todo канал остановки добавить
function start_robot_1( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello init robot. args=",args)

    let {output_port, index, id, count, f, f_arg} = args

    let out = rapi.create_cell(output_port[index])    

    let result = f( f_arg, index, rapi )

    if (result.then) {
      return result.then( data => {
        //console.log("map2 robot submitting output after promise")
        return out.submit( data )
      })
    } else
    //console.log("map2 robot submitting output")
    return out.submit( result )   

  }, args), {runner_id})
}
