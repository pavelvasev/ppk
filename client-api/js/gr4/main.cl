import std="std" dom="dom.cl" lib3d="lib3d.cl" ppk="./ppk/ppk.cl"
import ppk_api="js:../ppk/repr-ws-client-api.js"
import parts="std/parts.cl"

/*
  ideas 
   - тень графика. и она там все просчитывает красиво
   - останавливать чтение если окно неактивно
*/

rapi := ppk.connect

q1: ppk.query @rapi "gr(cell)"
react @q1.output {: req |
   console.log("see gr req",req)
:}

s1: ppk.shared @rapi "gr_view"
react @s1.output {: vals |
  //console.log("shared gr view:",vals)
  shared_view.submit( vals )
:}

shared_view: cell []

// корневые
shared_view_root := read @shared_view | filter {: val | return !val.parent_id :} 

s2: ppk.shared @rapi "abilities"
abilities: cell []
bind @s2.output @abilities 
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

    console.log("query data_port_id=",data_port_id)

    rapi.query( data_port_id ).done( msg => {
      let arr = msg.value
      //console.log(data_port_id,"=",counter.get())
      //console.log(data_port_id,"=",arr)
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
    rapi.msg( {label: data_port_id.get(), value: iv} )
    :}  
}

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

/*
      linepos := apply {: vals | 
        return vals.map( (val,index) => [index,val,0, index,0,0] ).flat(1)
        :} @src.output
      b2: lib3d.buffer @linepos 3
*/

/*
      linepos := apply {: vals | 
        let acc = []
        for (let i=0; i<vals.length; i+=3)
          acc.push( vals[i], vals[i+1],vals[i+2], vals[i], 0, vals[i+2])
         return acc 
        //return vals.map( (val,index) => [index,val,0, index,0,0] ).flat(1)
        :} @datapos
      b2: lib3d.buffer @linepos 3
*/      

      scene_items := {
        p1: lib3d.points color=[0.0,0.25,0.5] 
                positions=@b1.output 
                ///colors=@b2.output 
                scale=@source_subgr.scale
                position=(list 0 0 (* @prev_datapos_lines -1))
/*                
        lib3d.lines color=[1,1,1] strip=false
                //position=@p1.position
                scale=@scale
                positions=@b2.output //scale=(mk_scale @scale_x.value @scale_y.value) visible=@cb.value    
*/                
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
  //alfa22: cell 111

      // output := @self

      src: simple_data_source @rapi (+ @cell_id "/data(cell)")
      //print "src data=" @src.output

      //react @src.output {: val | console.log(555,val ) :}
      
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

/*
      linepos := apply {: vals | 
        return vals.map( (val,index) => [index,val,0, index,0,0] ).flat(1)
        :} @src.output
      b2: lib3d.buffer @linepos 3
*/

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

mixin "tree_node"
process "do_combobox" {
  in {
    cell_id: cell
    input: cell
    input_index: cell
    title: cell ""
  }

  index: cell
  simple_data_target @rapi ( + @cell_id "/index(cell)") input=@index
  
  gui_items := {
    dom.element "span" @title
    ds: dom.select input=@input input_index=@input_index
    bind @ds.index @index
  }
}

mixin "tree_node"
process "do_text" { // тут пока все вместе только для упрощения. а так источник и график конечно разделить
  in {
    cell_id: cell
    title: cell ""
  }

  src: simple_data_source @rapi (+ @cell_id "/data(cell)")
  bind @src.output @title
  
  gui_items := {
    dom.element "span" @title
  }
}

mixin "tree_node"
process "do_button" {
  in {
    cell_id: cell
    title: cell ""
    msg_on_click: cell
  }

  src: simple_data_source @rapi (+ @cell_id "/data(cell)")
  bind @src.output @title
  src2: simple_data_source @rapi (+ @cell_id "/msg(cell)")
  bind @src2.output @msg_on_click
  
  gui_items := {
    dom.button @title {:
      let lrapi = rapi.get()
      console.log("btn clicked, sending msg=",msg_on_click.get())
      lrapi.msg( msg_on_click.get() )
    :}
  }
}

process "do_container2" {
  in {
    cell_id: cell
    title: cell ""    
  }
  apply {: cell_id_value |
    let k = create_do_container()
  :} @cell_id
}

mixin "tree_lift"
process "create_from_records" {
  in {
    records: cell
  }
  repeater input=(read @records | filter {: val | return val.type == "gr" :}) { sv |
    init_params := get @sv "params"
    //print "init_params=" @init_params
    s: subgr (get @sv "id") **init_params
    subgr_shadow @s
  }
  // idea repeater input=@shared_view[type="combobox"] а хорошая штука css была. и питон молодец.
  // типа фильтр в синтаксическом геттере.. в css такое есть. и в питоне в либах.
  // как-то кстати питон вот в индекс умеет передать выражение.. как?
  repeater input=(read @records | filter {: val | return val.type == "combobox" :}) { sv |
    init_params := get @sv "params"
    do_combobox (get @sv "id") **init_params
  }
  repeater input=(read @records | filter {: val | return val.type == "text" :}) { sv |
    init_params := get @sv "params"
    do_text (get @sv "id") **init_params
  }
  repeater input=(read @records | filter {: val | return val.type == "button" :}) { sv |
    init_params := get @sv "params"
    do_button (get @sv "id") **init_params
  }
  repeater input=(read @records | filter {: val | return val.type == "container" :}) { sv |    
    apply_children @mk_container (get @sv "id")
    /*
    apply {: cell_id_value |
      let k = create_do_container({})
      k.cell_id.submit( cell_id_value )
      console.log("container created",k,"self is",self)
      self.append( k )
    :} (get @sv "id")
    */
  }
}

mixin "tree_node"
process "do_container" {
  in {
    cell_id: cell
    title: cell ""    
  }

  shared_view_my := filter @shared_view {: val | 
    console.log("compa",val.parent_id,cell_id.get())
    return val.parent_id == cell_id.get() :} 

    print "shared_view_my=" @shared_view_my

  create_from_records @shared_view_my
  
  gui_items := {
    dom.column {            
      parts.create (parts.get @self.children "gui_items")
    }
  }

  scene_items := {
    parts.create (parts.get @self.children "scene_items")
  }
}

mk_container := { id | do_container @id }

env: node {
  print "shared_view_root=" @shared_view_root
  create_from_records @shared_view_root  
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

/*
  ds: data_source
  gr_vals := @ds.output
  
  //  print "gr_vals=" @gr_vals

  datapos := apply {: vals | 
    return vals.map( (val,index) => [index,val,0] ).flat(1)
    :} @gr_vals
  b1: lib3d.buffer @datapos 3

  // F-COLORED-PARTS
  
  gr_vals_c2 := @ds.output_c2
  colors := apply {: vals | 
    
    let mapped = vals.map( (val,index) => {
      //if (val == 3) return [0.0,1.0,0.0]
      return [(0.7+val)*0.234234 % 1,(val*val*0.25 + 0.2) %1,(0.853 + 2*Math.sqrt(3+val)) % 1]
      } ).flat(1)
    //console.log("gr_vals_c2=",vals,"mapped=",mapped)
    return mapped
    :} @gr_vals_c2
  b2: lib3d.buffer @colors 3  
  */

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

    output_space: dom.element "div" style="border: 1px solid grey; flex: 1;" {      
      dom.element "div" style="position: absolute;" {
        dom.column {
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