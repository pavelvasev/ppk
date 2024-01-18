//import * as LINK from "./link.js"

////////////////////////////// continue
// пропускает последний поступивший сигнал по команде control

export function robot( rapi, id, workers ) {
  let N =1
  let input_port = workers.map( (x,index) => rapi.open_cell( `${id}/input/${index}` ) )
  let output_port = workers.map( (x,index) => rapi.open_cell( `${id}/output/${index}` ) )

  // control это запрос на данные. он не макро-канал а ячейка.
  // по причине что ну один зарпос на всех
  // хотя можно сделать и макроканалом.
  // мы конечно теряем мол негибко. так можно было бы индивидуально запросить
  // какой-то канал. но взамен получаем что одна посылка на всех
  // а там если надо ставьте фильтры..
  let control_port = [rapi.open_cell( `${id}/control` )]
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_robot( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,
         control_port,
         N
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port, 
                control: control_port }

  return robot
}

function start_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello continue robot. args=",args)

    let {input_port, output_port, control_port, index, id, count, N} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )

    let in_control = rapi.read_cell( control_port[0] )    

    let f = args.f
    
    let counter = 0;
    let last_val
    function tick() {
      in_data.next().then( val => {
        last_val = val
        counter++
        tick()
      })
    }
    
    function tack() {
      in_control.next().then( val => {
        //console.log("contiue robot see in-control. id=",id)
        if (counter == 0) {
          console.error("still was no input values!!!!!")
        } else
          out.submit( last_val )
        tack()       
      })
    }    

    tick()
    tack()

    return true

  }, args), {runner_id}) 
}

