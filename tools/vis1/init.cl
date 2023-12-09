load "ppk.cl"

//console-log "HI"
ppk: ppk-connect
q1:  ppk-query "coords" input=(@ppk.output | delay-ms 1000) // задержка чтобы отработало

k1: layer title="Общая информация" {
  cv-text value=@ppk.status

  shower: visual-process title="Показать" v1=true tscale=0.2 {
    gui {
      gui-tab "main" {
        gui-slot @shower "v1" gui={ |in out| gui-checkbox @in @out }
        gui-slot @shower "tscale" gui={ |in out| gui-slider @in @out min=0.001 max=1 step=0.001 }
      }
    }
  }
}

if @shower.v1 then={
  tasks type="step"
  tasks type="sync" color=[0,1,0] dx=0.4
  tasks type="average" color=[1,0,0] dx=0.6
}

feature "cv-text" {
  root: visual_process
  title="Текст на экране"
  value="Привет мир!"
  style="color:lime;"
  ~have-scene2d
  scene2d={
    text @root.value style=@root.style
  } {
    gui {
      gui-tab "main" {
        gui-slot @root "text" gui={ |in out| gui-string @in @out }
        gui-slot @root "style" gui={ |in out| gui-string @in @out }
      }
    }
  }
}

feature "tasks" {
k1: layer title=@k1.type type="" color=[1,1,1] dx=0 {
    tasks_pts: cv_points title="Точки задач" 
      input=(@tasks_coords.output | delay-ms 100) radius=0.1
      color=@k1.color
     {{ effect3d-pos x=(@k1.dx * @shower.tscale) }}
     {{ effect3d-scale x=@shower.tscale }}
     
    tasks_coords: cv_df output=(df-create | df-set X=0 Y=0 Z=0)
    //input=(read @root.tasks | df_mul X=@root.tscale)
    
    reaction @q1.output {: msg t=@k1.type c=@tasks_coords p=@tasks_pts |
      //console.log("see msg=",msg,"btw c=",c)
      let items = msg.append
      let df = c.params.output
      for (let line of items) {
        if (line.type == t)
        df.append_row(line)
      }
      //console.log("signalling")
      c.setParam( "output",df.clone_outer() )
      //c.signalParam("output")
      //p.signalParam("input")
    :}
}
}