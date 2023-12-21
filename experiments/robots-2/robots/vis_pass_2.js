import * as LIB from "./lib.js"

////////////////////////////// vis_pass2
// асинхронная визуализация

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
  // данные для визуализации - посылаются по получении control
  let vis_port = workers.map( (x,index) => rapi.open_cell( `${id}/vis/${index}` ) )

  // граф по завершеню работ должен послать данные сюда
  // те же самые что дал визуализатор или может быть обновленные.
  // граф бы мог писать и в output, но тогда будет путаница с владением ячеек
  // т.к. будет два владельца. поэтому пока так
  let continue_port = workers.map( (x,index) => rapi.open_cell( `${id}/continue/${index}` ) )
  LIB.create_port_link( rapi, continue_port, output_port )
  
  let count = workers.length  
  let r = workers.map( (x,index) => start_pass_each_robot( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,
         control_port,vis_port,
         N
         //f:rapi.compile_js(f)
       }))

  let robot = { input: input_port, output: output_port, 
                control: control_port, side_output: vis_port, main_continue: continue_port }

  return robot
}

function start_pass_each_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello vis_pass_2 robot. args=",args)

    let {input_port, output_port, control_port, vis_port, index, id, count, N} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )

    let in_control = rapi.read_cell( control_port[0] )
    let out_vis = rapi.create_cell( vis_port[index] )

    let f = args.f
    
    let counter = 0;
    function tick() {
      in_data.next().then( val => {
        //console.log("pass-each-robot. N=",N,"counter=",counter)
        console.log("vis-pass-2 robot see input data id=",id)

        //if (required > 0) required--
        //if (required == 1 && counter%3 == 0) {
        if (required > 0 && counter%3 == 0) {
          console.log("vis-pass-2 robot enters required space. id=",id,"required=",required,"sending data to out_vis",out_vis.id)
          required--
          out_vis.submit( val )
          // теперь задача подграфа уже высылать данные дальше
        } else
          out.submit( val )

        counter++
        
        tick()
      })
    }
    
    let required = 0
    function tack() {
      in_control.next().then( val => {
        console.log("vis-pass-2 robot see in-control. id=",id, "will wait for next data!")
        //required = 2
        required++
        tack()       
      })
    }    

    tick()
    tack()

    return true

  }, args), {runner_id}) 
}

