import std="std" dom="dom.cl" lib3d="lib3d.cl" //ppk="./ppk/ppk.cl"
import ppk_api="js:../ppk/repr-ws-client-api.js"

//rapi := ppk.connect
//q1 := ppk.query @rapi "vis1/vis/0(cell)"

process "data_source" {

  output: cell []
  counter: cell 0

  apply {:
    ppk_api.connect().then( (rapi) => {
        let data_port_id = "vis1/vis/0(cell)"
        let control_port_id = "vis1/control/0(cell)"

        function tick() {
          rapi.msg( {label: control_port_id, value: 1})                
        }
        tick()

        rapi.query( data_port_id ).done( msg => {
          console.log('query done: ',msg)
          tick()

          let arr = msg.value.payload[0]
          output.submit( arr )
          counter.submit( counter.get() + 1 )
        })

    })
  :}
}


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

process "data_source_1" {
  output := apply {: return Array(100*3).fill(0).map( (elem,index)=>Math.random() ) :} @tick
  tick := std.timer period=100
}

dom.custom "cl-main"
mixin "tree_node"
process "main" {
  in { style: cell }

  gr_vals := ds: data_source
  //print "gr_vals=" @gr_vals

  datapos := apply {: vals | 
    return vals.map( (val,index) => [index,val,0] ).flat(1)
    :} @gr_vals
  b1: lib3d.buffer @datapos 3

  output := dom.column style=@style {
    dom.dark_theme

    //btn: dom.element "button" "Visualize!" {: console.log("clicked") :}
    cb: dom.checkbox "lines visible"
    scale: dom.input "range" input_value=1 min=1 max=10000
    output_space: dom.element "div" style="border: 1px solid grey; flex: 1;" {
      dom.element "span" (+ "version: " @ds.counter) style="position: absolute;"
    }

    func "mk_scale" {: s | // масштаб по y..
       return [ 1, 1.0 / s, 1]
    :}

    s: lib3d.scene {
      lib3d.point_light    
      p1: lib3d.points color=[1,0,1] 
              positions=@b1.output scale=(mk_scale @scale.interactive_value)
      lib3d.lines color=[1,1,1] strip=true
              positions=@b1.output scale=(mk_scale @scale.value) visible=@cb.value
      big_grid range=[0,0,300,50] step=[10,10]
    }

    cam: lib3d.camera position=[150,20,100] look_at=[150,0,0]
    cam_control: lib3d.camera_control camera=@cam.output dom=@rend.canvas // target=[150,0,0]

    rend: lib3d.render input=@s.output view_dom=@output_space.output camera=@cam.output    
  }
}