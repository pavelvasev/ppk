import * as LINK from "./link.js"

////////////////////////////// vis_pass 4
// асинхронная визуализация
// рандеву. команду принимает 1 робот, и назначает остальным итерацию.

/*
  робот читает порт input и пересылает данные в порт output
  также робот читает канал control
  когда в control поступают данные, то робот разово пересылает данные не в порт output, 
  а в порт side_output

  считается что данные будут там обрабатываться внешним графом.

  считается что как-то отработает норм доступ к данным (разберемся как)
*/


let verbose=false

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

  // канал рандеву - по нему рассылаются номера итераций на которых надо сделать переключение
  let randevu_port = [rapi.open_cell( `${id}/randevu` )]

  // данные для визуализации - посылаются по получении control
  let vis_port = workers.map( (x,index) => rapi.open_cell( `${id}/vis/${index}` ) )

  let count = workers.length  
  let r = workers.map( (x,index) => start_robot( rapi,x,
       { index, id:`${id}/${index}`,
         input_port,output_port,count,
         control_port,vis_port, randevu_port,verbose,
         N
         //f:rapi.compile_js(f)
       }))

  let deployed = rapi.wait_all( r )

  let robot = { input: input_port, output: output_port, deployed,
                control: control_port, side_output: vis_port }

  return robot
}

function start_robot( rapi, runner_id, args ) {
  return rapi.exec( rapi.js( (args) => {
    console.log("hello vis_pass_3 robot. args=",args)

    let SHIFT_AHEAD = 110

    let {verbose,input_port, output_port, control_port, randevu_port, vis_port, index, id, count, N} = args

    let in_data = rapi.read_cell( input_port[index] )
    let out = rapi.create_cell( output_port[index] )

    let in_control = index == 0 ? rapi.read_cell( control_port[0] ) : null
    let out_randevu = index == 0 ? rapi.create_cell( randevu_port[0] ) : null
    let in_randevu = index > 0 ? rapi.read_cell( randevu_port[0] ) : null
    let out_vis = rapi.create_cell( vis_port[index] )

    let f = args.f
    
    let counter = 0;
    function tick() {
      in_data.next().then( val => {
        //console.log("vis-pass. iter counter=",counter)
        if (verbose)
            console.log("vis-pass robot see input data id=",id,"iter counter=",counter)

        //if (required > 0) required--
        //if (required == 1 && counter%3 == 0) {
        if (required == counter) {
          if (verbose)
              console.log("vis-pass robot enters required space. id=",id,"required=",required,"sending data to out_vis",out_vis.id)          
          required = -1
          out_vis.submit( val ).then( () => {
            out.submit( val )
          })
          // теперь задача подграфа уже высылать данные дальше
        } else
          out.submit( val )

        counter++
        
        tick()
      })
    }
    
    let required = -1
    function tack() {
      in_control.next().then( val => {
        //required = 2

        // выяснилось что на сдвиге +2 оно зависает. а на +3 нет.
        // на +3 при 10 воркерах тоже.. там похоже гусеница получается..
        // без синхронизации это виснет. и надо увеличивать окно.
        required = counter + SHIFT_AHEAD
        // да похоже так и есть.. тонкое местечко..

        if (verbose)
            console.log("vis-pass robot see in-control. id=",id,"sending randevu=",required)

        
        out_randevu.submit( required )
        tack()       
      })
    }    

    function tuck() {
      in_randevu.next().then( val => {
        if (verbose)
            console.log("vis-pass-3 robot see in-randeuv. id=",id,"randevu=",val)
        //required = 2
        required = val        
        tuck()
      })
    }        

    tick()
    if (in_control) tack()
    if (in_randevu) tuck()      

    return true

  }, args), {runner_id}) 
}

