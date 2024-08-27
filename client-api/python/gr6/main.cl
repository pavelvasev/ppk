import std="std" dom="dom.cl" lib3d="lib3d.cl" ppk="./ppk/ppk.cl"


rapi := ppk.connect

q1 := ppk.query @rapi "test"

react @q1 {: msg |
  console.log("see test msg:",msg)
:}

func "create_component" {: rapi descr attach_to my_id |    

    //let my_id = "obj" + Math.random().toString()
    if (!my_id) // какое-нибудь id ему... бывает же что нет id..
        my_id = "obj" + Math.random().toString()
    // либо другая идея - если не указано id то не слушать каналы и не отправлять их    

    let t = descr.type;
    let fn_name = "create_" + t;
    let params = descr.params;
    let fn = eval(fn_name)
    let result = fn( params );
    console.log("created component: ",result);
    //let robj = root_obj.get()
    //console.log("btw root_obj=",robj)
    //console.log("btw self=",self)
    
    // todo bind channels to global
    // todo create id and return/assign it...
    /*
      формально каждый канал ведет к обращению к серверу main. 
      можно это оптимизировать если обращаться только заради объекта. 
      или вовсе посылать только 1 запрос к main от узла исполнителя 
      например некоего корня, а все остальное уже локально маршрутизировать...
    */
    //let tgt = root_obj[ target_id ];
    console.log("attaching to:",attach_to)
    if (attach_to.host)
      attach_to = attach_to.host;
    attach_to.append( result )

    // входные каналы
    let input_channels = result.inputs;
    if (input_channels) {
      input_channels.once( list_of_names => {
        for (var name of list_of_names) {          
          let lname = name;
          let cname = my_id + "/" + name;
          //console.log("LISTENING TO cname=",cname);
          rapi.query( cname ).done( msg => {              
              let val = msg.value;
              result[ lname ].submit( val );
          })
        }
      })
    }

    if (result.outputs) {
      result.outputs.once( list_of_names => {
        for (var name of list_of_names) {          
          let lname = name;
          let cname = my_id + "/" + name;
          //console.log("GONNA SEND TO cname=",cname);
          result[ lname ].subscribe( value => {
            rapi.msg( {label:cname, value} )
          })          
        }
      })
    }

    // items
    for (var x of (descr.items || [])) {
      create_component( rapi, x, result, my_id + "/" + x.id );
    }
    return result;
:}

process "component_creator" {
  in {
    rapi: cell
    //root_obj: cell
    channel_id: cell "gui/create_component"
  }

  q2 := ppk.query @rapi @channel_id

  react @q2 {: msg |
    console.log("see msg gui/create_component:",msg)
    let root_obj = self.attached_to;
    let parts = msg.value.target_id.split("/");
    let attach_to = root_obj[ parts[0] ];
    for (let i=1; i<parts.length; i++) {
        let childs = attach_to.children.get();
        attach_to = childs.find( c => c.$title = parts[i] )

        if (!attach_to) {
          console.error("component_creator: failed to find part i=",i,"in parts",parts)
          console.error(" root_obj=",root_obj)
          return;
        }
    }
    let descr = msg.value.description;
    create_component( rapi.get(),descr,attach_to, msg.value.id );
  :}

  react @rapi {: rapi |
    setTimeout( () => {
    let m = {"label":"gui_attached","value":{"id":channel_id.get()}};
    console.log("sending gui-attached msg",m)
     rapi.msg(m)
     },1000)
  :}

}

mixin "tree_node"
process "text" {
  in {
    value: cell
  }
  inputs := list "value"
  output := dom.element "span" innerHTML=@value
}

mixin "tree_node"
process "lines" {
  in {
    colors: cell
    color: cell
    positions: cell
    append_data: channel
    radius: cell 1
    scale: cell [1,1,1]
  }
  inputs := list "color" "colors" "positions" "append_data"

  react @append_data {: xtra |
    console.log("see append_data",xtra)
    let pos = xtra.p;
    let col = xtra.c;
    let p = positions.get();
    let c = colors.get();
    colors.submit( c.concat( col ));
    positions.submit( p.concat( pos ));
    // todo мб там у буфера есть методы аппенда?
 :}

  buf1: lib3d.buffer @positions 3
  buf2: lib3d.buffer @colors 3

  //react @buf2.output {: xxx | console.log("colors=",xxx) :}
  
  output := lib3d.element {
    // colors=@buf2.output
    p1: lib3d.lines color=@color colors=@buf2.output positions=@buf1.output radius=@radius scale=@scale
  }
}

mixin "tree_node"
process "big_grid" {
  in { 
    color: cell [0,0.5,0]
    range: cell [0,0,1000,1000]
    step: cell [100,100]
    position: cell [0,0,0]
    rotation: cell [0,0,0]
    n_rest**: cell
  }
  inputs := list "color" "range" "step" "position" "rotation"

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
              position=@position rotation=@rotation
              **n_rest
  }
}

dom.custom "cl-main"
mixin "tree_node"
process "main" {
  in { style: cell }

  output := qqq: dom.column style=@style {
    dom.dark_theme

    topline: dom.row style="gap:0.5em;" {
        dom.element "span" "PPK"
    }

    output_space: dom.element "div" style="border: 1px solid grey; flex: 1;" {
      inner_space1: dom.element "div" style="position: absolute; padding: 10px;" {      
        dom.element "span" ""
      }
    }

    //inner_space: const @inner_space1

    // todo эта сцена по идее тож динамически, равно как и render.. ну ладно пока
    s: lib3d.scene {
      lib3d.point_light
      //big_grid
    }

    cam: lib3d.camera position=[150,20,100] look_at=[150,0,0]
    cam_control: lib3d.camera_control camera=@cam.output dom=@rend.canvas // target=[150,0,0]

    rend: lib3d.render input=@s.output view_dom=@output_space.output camera=@cam.output

    component_creator @rapi (apply {: return "gui/create_component" + Math.random() :})
  }
}