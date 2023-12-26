// v2 - без увеличения буферов на границах.

export function robot( rapi, id, workers,f ) {
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot_1( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,
         f:rapi.compile_js(f)
       }))


  let deployed = rapi.wait_all( r )
  /*
  deployed.then( channels => {
    console.log("stencil-1d robot ",id," ready. subrobot channels=",channels)
  })
  */

  let robot = { input: input_port, output: output_port, deployed }

  return robot
}

// todo канал остановки добавить
function start_robot_1( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello stencil-1d robot. args=",args)

    let {input_port, output_port, index, id, count} = args

    let in_data = rapi.read_cell( input_port[index] )
    let left = index > 0 ? rapi.read_cell(input_port[index-1]) : null
    let right = index < count-1 ? rapi.read_cell(input_port[index+1]) : null

    let out = rapi.create_cell(output_port[index])

    let f = args.f
    
    let counter = 0;
    function tick() {
      //console.log( "wait" )
      Promise.all( [in_data.next(), left ? left.next() : null, right ? right.next() : null] ).then( vals => {
        //console.log("ready!")
        //console.log("stencil-1d tick data! ",counter++)
        let [me,left_info,right_info] = vals
        rapi.get_one_payload( me.payload_info[0] ).then( data => {
          //console.log("payload!")
          //console.log("my data is",data,"processing")

          //if (left_info) data[0] = left_info.right
          if (right_info) data[ data.length-1 ] = right_info.left

/*        долгое:
          let k = data.length-1;        
          for (let i=1; i<k; i++) {
            data[i] = f( data[i], data[i-1], data[i+1] )
          }
*/

          let k = data.length-1;
          let p_left = left_info ? left_info.right : 0
          let p_my   = 0
          let p_right = data[0]
          //let p_right = 0
          //let t1 = process.hrtime.bigint()
          for (let i=0; i<k; i++) {
            p_my = p_right
            p_right = data[i+1]
            data[i] = f( p_my, p_left, p_right )
            //data[i] = (p_left + p_right)/2 + Math.random()
            p_left = p_my
          }

          // последняя итерация
          p_my = p_right
          p_right = right_info ? right_info.left : 0
          data[k] = f( p_my, p_left, p_right )

          //console.log("processed")

/*
          let pi = rapi.submit_payload_inmem( data )
          console.log("payload-sent")
          out.submit( { left: data[1], right: data[k-1], payload_info: [pi] })
*/          

          rapi.submit_payload_inmem( data ).then( pi => {
            //console.log("payload-sent")
            out.submit( { left: data[0], right: data[k], payload_info: [pi] })
          })
          
        })
      }).then( tick )
    }

    tick()

    //console.log("io=",{in,out})

    return true

  }, args), {runner_id}) 
}
