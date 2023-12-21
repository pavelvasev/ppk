////////////////////////////// clone_data
// клонирует данные и отправляет их куда-то дальше
// проект.
// всего содержит K копий данных. При превышении
// пользуется старыми. Лучше всего если K=1.

export function robot( rapi, id, workers ) {
  let N =1
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )
  let control_port = workers.map( (x,index) => rapi.open_cell( `${id}/control/${index}` ) )
  let vis_port = workers.map( (x,index) => rapi.open_cell( `${id}/vis/${index}` ) )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_pass_each_robot( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,
         control_port,vis_port,
         N
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port, control: control_port, vis: vis_port }

  return robot
}

function start_pass_each_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello vis_pass robot. args=",args)

    let {input_port, output_port, control_port, vis_port, index, id, count, N} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )

    let in_control = rapi.read_cell( control_port[index] )
    let out_vis = rapi.create_cell( vis_port[index] )

    let f = args.f
    
    let counter = 0;
    function tick() {
      in_data.next().then( val => {
        //console.log("pass-each-robot. N=",N,"counter=",counter)

        //console.log("data was required! val=",val)

        // щас будет еще вопрос аттача.            
        if (val.payload_info && val.payload_info.length > 0)
        {
          //console.log("data required. it has payload: ", val.payload_info[0])
          rapi.get_one_payload( val.payload_info[0] ).then( data => {
            //console.log("ok it loaded. re-submitting!")
            let copy = data.slice()
            //console.log("copy=",copy)
            // todo запоминать, стирать..
            rapi.submit_payload_inmem( copy ).then( payload_info => {
               let val_copy = {...val}
               val_copy.payload_info = [payload_info]
               // важно в исходном val оставить какое надо payload_info - старое
               out_vis.submit( val_copy )
               out.submit( val )
               // итого мы сделали копию. и только после этого передали управление.
            })            
          })
        } else {
            out_vis.submit( val ) 
            out.submit( val )            
        }        

        counter++
        
        tick()       
      })
    }
    
    let required = 0
    function tack() {
      in_control.next().then( val => {
        required++        
        tack()       
      })
    }    

    tick()
    tack()

    return true

  }, args), {runner_id}) 
}

