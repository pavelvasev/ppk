// Описание языка программирования Compalang:
// https://github.com/viewzavr/vrungel/tree/main/develop/compalang

load "lib3dv3 csv params io gui render-params df scene-explorer-3d new-modifiers imperative"
load "https://vr.viewlang.ru/vrungel/apps/coview-3/init.cl"
load "ppk.cl"

//////

show-file-progress export-image animation
settings-cmd
coview-app-design

//console-log "HI"
ppk: ppk-connect
q1:  ppk-query "coords" input=(@ppk.output | delay-ms 1000) // задержка чтобы отработало

project: the_project artefacts_library=null
{

  k1: layer title="Базовое" 
  {

    cam: camera pos=[10,10,10] //ortho=1 ortho_zoom=30
    axes_view names="step runner block"
     // размеры осей size=5 букв 0.2
  
    cv-text value=@ppk.status

    shower: visual-process title="Настройка отображения" v1=true tscale=0.2 transfer_reuse=true
    {{ addon-map-control }}
    {
      gui {
        gui-tab "main" {
          gui-slot @shower "v1" gui={ |in out| gui-checkbox @in @out }
          gui-slot @shower "transfer_reuse" gui={ |in out| gui-checkbox @in @out }
          gui-slot @shower "tscale" gui={ |in out| gui-slider @in @out min=0.001 max=1 step=0.001 }
        }
      }
    }
  }

  if @shower.v1 then={
    tasks type="step" color=[1,1,1]
    tasks type="sync" color=[0,1,0] //dx=0.4
    tasks type="average" color=[0,0,1] //dx=0.6

    tasks type="when-all" color=[1,0,0] //dx=0.6
  }
  if @shower.v1 then={
    transfer-reuse color=[1,1,0] type="reuse" radius=2
    transfer-reuse color=[0.7,0.7,0] type="promise" radius=5
    transfer-reuse color=[0.7,0.7,0.7] type="simple" radius=1 opacity=0.3
    transfer-reuse color=[0.7,1,0.7] type="alloc" radius=1 //opacity=0.3
  }

  v1: the_view_recursive title="Визуализация" actions={}
    {
        area_container_horiz {
          //area_3d sources_str="@l1"
          area_3d
        }
    }

}

//////////////////////////////////////////////////////// главное окно программы

screen1: screen ~auto-activate  {
  rp: render_project @project active_view_index=0
        top_row_items={}
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
      input=(@tasks_coords.output | delay-ms 100) radius=0.3
      color=@k1.color
     {{ effect3d-pos x=(@k1.dx * @shower.tscale) }}
     {{ effect3d-scale x=@shower.tscale }}
     
    tasks_coords: cv_df output=(df-create | df-set X=0 Y=0 Z=0)
    //input=(read @root.tasks | df_mul X=@root.tscale)
    
    reaction @q1.output {: msg t=@k1.type c=@tasks_coords p=@tasks_pts |
      //console.log("see msg=",msg,"btw c=",c)
      let items = msg.append 
      if (!items) return
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

feature "transfer-reuse" {
k1: layer title=("Передача данных " + @k1.type) color=[1,1,1] dx=0 type="promise" radius=5 opacity=1 {
    tasks_pts: cv_lines title="Передача данных" 
      input=(@tasks_coords.output | delay-ms 100) radius=@k1.radius
      color=@k1.color
     {{ effect3d-pos x=(@k1.dx * @shower.tscale) }}
     {{ effect3d-scale x=@shower.tscale }}
     {{ effect3d-opacity opacity=@k1.opacity }}
     
    tasks_coords: cv_df output=(df-create | df-set X=0 Y=0 Z=0 X2=0 Y2=0 Z2=0)
    //input=(read @root.tasks | df_mul X=@root.tscale)
    
    reaction @q1.output {: msg t=@k1.type c=@tasks_coords p=@tasks_pts |
      //console.log("see msg=",msg,"btw c=",c)
      let items = msg.line 
      if (!items) return

      let type = items[2]
      if (type != t) return

      let line = items[0]
      line.X2 = items[1].X
      line.Y2 = items[1].Y
      line.Z2 = items[1].Z
      //console.log("got line",line)

      let df = c.params.output
        df.append_row(line)
      //console.log("signalling")
      c.setParam( "output",df.clone_outer() )
      //c.signalParam("output")
      //p.signalParam("input")
    :}
}
}