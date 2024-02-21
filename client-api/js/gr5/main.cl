import std="std" dom="dom.cl" lib3d="lib3d.cl" ppk="./ppk/ppk.cl"
import ppk_api="js:../ppk/repr-ws-client-api.js"
import parts="std/parts.cl"

/*
  ideas 
   - тень графика. и она там все просчитывает красиво
   - останавливать чтение если окно неактивно
*/

func "map_to_arr" {: h |
    let arr = []
    for (let k in h) {
      let rec = h[k]
      rec.name = k
      arr.push( rec )
    }
    return arr
:}

func "arr_to_map" {: arr key |
    let h = {}
    for (let k of arr) {
      h[ k[key] ] = k
    }
    return h
:}

rapi := ppk.connect


shared_view := ppk.shared @rapi "gr_view"

abilities := ppk.shared @rapi "abilities"
// каждая запись это
// title, msg_template

process "simple_data_source" {

  in {
    rapi: cell
    data_port_id: cell
  }

  output: channel
  //output_c2: cell []
  counter: cell 0

  apply {: rapi data_port_id |

    //console.log("query data_port_id=",data_port_id)

    rapi.query( data_port_id ).done( msg => {
      let arr = msg.value
      //console.log(data_port_id,"=",counter.get())
      // console.log(">>>>",data_port_id,"=",arr)
      output.submit( arr )
      //output_c2.submit( msg.value.payload[1] )
      counter.submit( counter.get() + 1 )
    })
  :} @rapi @data_port_id
}

process "pause" {
  in {
    input: channel
    t: cell 0
  }
  output: channel

  react @input {: iv |    
    setTimeout( () => {
      //console.log("sending val after pause",t.get())
      output.submit( iv )
      }, t.get() || 0 )
  :}
}

process "simple_data_target" {

  in {
    c_rapi: cell
    data_port_id: cell
    input: channel    
  }

  counter: cell 0

  react @input {: iv |
    let rapi = c_rapi.get()
    let m = {label: data_port_id.get(), value: iv}
    //console.log("simple_data_target sending",m)
    rapi.msg( m )
    :}
}

/* идеи
append_child @gui_panel {
}
mixin_to @gui_panel {
}
*/

//print "env ch = " @env.children

/*
так. там в визуализации надо уже делать преобразования.
источник - фильтры конверторы - рисователь. такое надо.
*/

// todo оптимизировать
mixin "tree_node"
process "subgr_shadow" {
  in {
    source_subgr: const   
  }
      
      prev_datapos: state []      
      prev_datapos_lines: cell 0

      datapos := apply {: mapped |
        let z = prev_datapos_lines.get()+1

        for (let i=0; i<mapped.length; i+=3)
          prev_datapos.push( mapped[i], mapped[i+1], z )           

        if (z >= 50) {
          prev_datapos = prev_datapos.slice( mapped.length )           
        } else {
          prev_datapos = prev_datapos.slice()
        }
        prev_datapos_lines.submit( z )
        return prev_datapos
      :} @source_subgr.datapos

      b1: lib3d.buffer @datapos 3

 

      scene_items := {
        p1: lib3d.points color=[0.0,0.25,0.5] 
                positions=@b1.output 
                ///colors=@b2.output 
                scale=@source_subgr.scale
                position=(list 0 0 (* @prev_datapos_lines -1))
               
      }

}

mixin "tree_node"
process "subgr" { // тут пока все вместе только для упрощения. а так источник и график конечно разделить
  in {
    cell_id: cell
    title: cell ""
    sx: cell 1
    sy: cell 1
      //gtype: cell "linear"
  }

      src: simple_data_source @rapi (+ @cell_id "/data(cell)")
      
      param_src: simple_data_source @rapi (+ @cell_id "/params(cell)")

      simple_data_target @rapi ( + @cell_id "/updated(cell)") input=(pause @src.counter 30)

      react @param_src.output {: params |
         //console.log("incoming params=",params)
         for (let k in params) {
           let my = self[k]
           if (my && my.submit) my.submit( params[k] )
         }
      :}
      
      /* ползание
      prev_datapos: state []      
      prev_datapos_lines: state 0
      datapos := apply {: vals | 
        prev_datapos_lines++
        let mapped = vals.map( (val,index) => [index,val,prev_datapos_lines] ).flat(1)
        prev_datapos = prev_datapos.concat( mapped )
        if (prev_datapos_lines > 20) {
           prev_datapos = prev_datapos.slice( mapped.length )
        }
        //prev_datapos_lines.submit( prev_datapos_lines.get()+1)
        return prev_datapos
      :} @src.output
      */

      datapos := apply {: vals |
        //console.log(333)

        // случай когда присылают данные из канала вычислений
        // хак.. надо внедрять внешний адаптер
        if (vals.payload) vals = vals.payload[0]

        let mapped = vals.map( (val,index) => [index,val,0] ).flat(1)
        //console.log({mapped})
        return mapped
      :} @src.output

      b1: lib3d.buffer @datapos 3


      linepos := apply {: vals | 
        let acc = []
        for (let i=0; i<vals.length; i+=3)
          acc.push( vals[i], vals[i+1],vals[i+2], vals[i], 0, vals[i+2])
         return acc 
        //return vals.map( (val,index) => [index,val,0, index,0,0] ).flat(1)
        :} @datapos
      b2: lib3d.buffer @linepos 3

      scene_items := {
        p1: lib3d.points color=[1,1,1] 
                positions=@b1.output 
                ///colors=@b2.output 
                scale=@scale
                //position=(list 0 0 @prev_datapos_lines)
        lib3d.lines color=[1,1,1] strip=false
                //position=@p1.position
                scale=@scale
                positions=@b2.output //scale=(mk_scale @scale_x.value @scale_y.value) visible=@cb.value    
      }

      func "mk_scale2" {: sx sy | // масштаб по y..
       return [ 1 / sx, 1 / sy, 1]
      :}


      scale := mk_scale2 @sx @sy

      gui_items := {
        dom.column style="background: rgb( 72 72 72 / 63% ); padding: 10px; border: 1px solid grey;" {
          dom.element "strong" @cell_id
          dom.element "span" @title
          dom.element "span" ("div y =" + @sy)
          scale_y: dom.input "range" input_value=@sy min=1 max=10000
          dom.element "span" ("div x =" + @sx)
          scale_x: dom.input "range" input_value=@sx min=1 max=100
          bind @scale_x.interactive_value @sx    
          bind @scale_y.interactive_value @sy

          dom.element "span" ("read counter=" + @src.counter)
        }
      }
}

/////////////////////////

mixin "tree_node"
process "proxy_proc" {
 in {
   p_rapi: cell
   proc: cell // запись о процессе
   gui_list: cell
 }
 // это есть выход
 id := get @proc "id"
 gui := get @gui_list @id

 unsub: state

 //print "proc_id=" @id "gui_list=" @gui_list "gui_record=" @gui

 show_gui := {
   dom.element "span" "Hello"
 }

 react @gui {: gui |  
    let rapi = p_rapi.get()
    let pid = id.get()
    //console.log("gui=",gui,"rapi=",rapi)
    gui ||= {}
    gui.input ||= {}
    if (self.unsub) self.unsub()
    let unsubs = []
    for (let k in gui.input) 
    {
      let c = CL2.create_cell()
      let label = pid + "/" + k + "(cell)"
      let unsub1 = rapi.query( label ).done(msg => {
        console.log("see remote val for param",k,msg)
        c.submit( msg.value )
      })
      let unsub2 = c.subscribe( val => {
        // todo проверять и высылать только если это новое значение
        console.log("see local val for param",k,val)
        rapi.msg( {label, value: val })
      })
      unsubs.push( unsub1 , unsub2  )
      // добавляем созданную ячейку в объект
      self[k] = c
    }
    self.unsub = () => {
      unsubs.map( x => { if (x) x() } )  
      unsubs = []
    }
 :}

 react @self.release {: if (self.unsub) self.unsub() :}

}

mixin "tree_node"
process "remote_space" {
  in {
    rapi: cell
    space_id: cell "pr_list"
  }
  // ссылки еще надо
  remote_processes_list := ppk.shared @rapi @space_id
  remote_gui_list := ppk.shared @rapi (+ @space_id "/gui") | arr_to_map "id"
  //print "gui id" (+ @space_id "/gui")

  //output: cell [] // список процессов. каждый процесс это объект clon

  repeater @remote_processes_list { proc |
    proxy_proc @rapi @proc @remote_gui_list
  }

  //children_map := arr_to_map @self.children "id"
}

process_space: remote_space @rapi "pr_list"

/////////////////////////

// ну это вообще все созданные
  pr_list := ppk.shared @rapi "pr_list"
  print "pr_list=" @pr_list
  
  active_process: cell

/////////////////////////    

mixin "tree_node"
process "show_processes_gui" {

  in {
    arg_process_space: cell
  }

  //procs: cell []
  //bind (get @arg_process_space "children") @procs
  //print "XXX=" (get @arg_process_space "children" | read_value)

  gui_items_row2 := {    
    dom.element "span" "Процессы:"

      //print "XXX=" (read (get @arg_process_space "children")) // (get @process_space "children")
    
      repeater input = (get @arg_process_space "children" | read_value) { item |
        dom.row {
          dom.button (get @item "id" | read_value) {:
            active_process.submit( item )
          :}
        } 
      }

          /*
          dom.button "x" {: 
            let lrapi = rapi.get()
            
            let msg = { label: "stop_process", id: item.id }
            console.log("btn clicked, sending msg=",msg)
            lrapi.msg( msg )
            :}
          */      
  }
 
}


/*
  process_gui:
    {
       input: {
          "alfa" : { type: "string" },
          "beta" : { type: "port" },
       },
       output: {
          "beta" : { type: "string" },
          "c" : { type: "port" }
       },
       commands: {
          "restart": true
       }
    }     
*/

pr_list_links := read @pr_list | filter {: x | return x.type == "link_process" :}
pr_list_links_tgt := apply {: links | 
  let h = {}
  for (let k of links) h[ k.arg.tgt ] = k
  return h
  :} @pr_list_links

//print "pr_list_links_tgt=" @pr_list_links_tgt

active_ports := ppk.shared @rapi "ports"
active_ports_select_variants := concat (list (list "-" "-")) (map @active_ports {: p | return [p.id,p.id] :})
//print "active_ports=" @active_ports @active_ports_select_variants

input_params_r := dict 
        string={ proc param_record |
          name := get @param_record "name"

          dom.element "span" ( + @name "*:")
          di: dom.input "text"

          process_cell := get @proc @name
          if @process_cell {
          react (read_value @process_cell) {: val |
            //console.log("DDD val=",val)
            di.input_value.submit( val )
          :}
          react @di.value {: val |
            let cell = process_cell.get()
            cell.submit( val)
            :}
          }
        }
        range={ proc param_record |
          name := get @param_record "name"

          dom.element "span" ( + @name "*:")
          di: dom.input "range" min=(get @param_record "min") max=(get @param_record "max") step=(get @param_record "step")

          process_cell := get @proc @name

          if @process_cell {
          react (read_value @process_cell) {: val |
            di.input_value.submit( val )
          :}
          react @di.value {: val |
            let cell = process_cell.get()
            cell.submit( val )
            :}
          }
        }
        port={ proc param_record |
          //print "hello from string" @param_record
          name := get @param_record "name"
          dom.element "span" ( + @name " (select src):")
          path := + (get @proc "id" | read_value) "/" @name
          known_src := or (get @pr_list_links_tgt @path) (dict arg=(dict src="-"))
          known_src_path := (get @known_src "arg" | get "src")
          print "known_src_path=" @known_src_path
          //dom.element "span" (get @known_src "arg" | get "src")

          ds: dom.select @active_ports_select_variants input_value=@known_src_path

          react @ds.value {: new_src |
            let k = known_src.get()
            //if (k.id)
            console.log("user select new tgt:",{new_src,k})
            // надо теперь удалить старый процесс ссылки
            let lrapi = rapi.get()
            if (k?.id) {
              // треш конечно эти глобальные ссылки.. как это все отследить?              
              let msg = { label: "stop_process", id: k.id }
              lrapi.msg( msg )
            }
            // теперь надо создать новую ссылку
            if (new_src != "-") {
              console.log("creating new link",new_src,"to",path.get())
              let id = "select_link_" + Math.random()
              let msg = { label: "start_process", type:"link_process",id, arg:{ src:new_src,tgt:path.get()} }
              lrapi.msg( msg )
            }
            :}
        }

mixin "tree_lift"
process "show_process_gui3" 
{
   in {
     //id: cell
     proc: cell
     //gui: cell
   }

   id := get @proc "id" | read_value
   gui := or (get @proc "gui" | read_value) (dict input=(dict))

   clear_current_gui: cell null
    
    dom.row style="gap:0.2em" {
      dom.element "span" @id
      dom.button "X" {: 
            let lrapi = rapi.get()
            let msg = { label: "stop_process", id: id.get() }
            //console.log("btn clicked, sending msg=",msg)
            lrapi.msg( msg )
            active_process.submit( null )
            :}
    }      

    gui_div: dom.column {
      input_params := get @gui "input" | map_to_arr
      print "input_params=" @input_params

      r1: repeater input=@input_params { param_record |
        type := get @param_record "class"
        fn := get @input_params_r @type
        // dom.element "span" @type
        //print "fn=" @fn
        // todo разобраться почему 2 раза 
        apply_children @fn @proc @param_record
      }
      //print "r1 children=" @r1.children
    }  

    print "gui-div children=" @gui_div.children
}

gr_processes := dict gr={ record |
    init_params := get @record "params" // todo arg?
    //print "init_params=" @init_params
    s: subgr (get @record "id") **init_params
    subgr_shadow @s
}

mixin "tree_lift"
process "create_gr_processes" {
  in {
    records: cell
  }
  repeater input= @records { record |
    type := get @record "class"
    fn := get @gr_processes @type
    //print "fn=" @fn
    // todo разобраться почему 2 раза 
    apply_children @fn @record
  }
}  

env: node {
  show_processes_gui @process_space
  create_gr_processes @shared_view
}

/////////////


mixin "tree_node"
process "big_grid" {
  in { 
    color: cell [0,0.5,0]
    range: cell [0,0,1000,1000]
    step: cell [100,100]
  }
  buf: lib3d.buffer @datapos 3
  datapos := apply {: range step |
    let coords = []
    for (let x=range[0]; x<=range[2]; x+= step[0]) {
      coords.push( x, range[1], 0 )
      coords.push( x, range[3], 0 )
    }
    for (let y=range[1]; y<=range[3]; y+= step[1]) {
      coords.push( range[0], y, 0 )
      coords.push( range[2], y, 0 )
    }
    return coords
    :} @range @step

  output := lib3d.element {
    p1: lib3d.lines color=@color
              positions=@buf.output
  }
}

process "data_source_rnd" {
  output := apply {: return Array(100*3).fill(0).map( (elem,index)=>Math.random() ) :} @tick
  output_c2 := []
  counter: cell 0  
  tick := std.timer period=100
}

dom.custom "cl-main"
mixin "tree_node"
process "main" {
  in { style: cell }

  output := dom.column style=@style {
    dom.dark_theme

    dom.row style="gap:0.5em;" {
      dom.element "span" "Добавить:"
      repeater input=@abilities { sv |
          title := get @sv "title"
          dom.button @title {: 
            console.log("clicked",sv ) 
            let lrapi = rapi.get()
            lrapi.msg( sv.msg )
          :}
      }
    }

    dom.row style="gap:0.5em;" {
      parts.create (parts.get @env.children "gui_items_row2")
      //print "calling row2 parts create:" (parts.get @env.children "gui_items_row2")
    } 

    output_space: dom.element "div" style="border: 1px solid grey; flex: 1;" {      
      dom.element "div" style="position: absolute; padding: 0px;" {

        show_process_gui3 @active_process

        dom.column style="gap:0.5em;" {          
          parts.create (parts.get @env.children "gui_items")
        }
      }      
    }

    s: lib3d.scene {
      lib3d.point_light    

      big_grid range=[0,0,300,50] step=[10,10]

      parts.create (parts.get @env.children "scene_items")
    }

    cam: lib3d.camera position=[150,20,100] look_at=[150,0,0]
    cam_control: lib3d.camera_control camera=@cam.output dom=@rend.canvas // target=[150,0,0]

    rend: lib3d.render input=@s.output view_dom=@output_space.output camera=@cam.output    
  }
}