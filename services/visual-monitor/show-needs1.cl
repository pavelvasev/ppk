// первая версия с зависимостями

/* Потребности
   * сдвигать до первой timestamp
   * назначать runner-ам координату и повторно ее использовать
*/

coview-record title="Просмотр Needs" type="show-needs" cat_id="process"

load "ppk.cl"

feature "filter" {: env |
  env.trackParam("input", v => {
    let f = env.params[0]
    if (f?.bind && f(v)) {
      env.setParam("output",v)
    }
  })
:}

feature "fapply" {: env |
  env.trackParam("input", v => {
    let f = env.params[0]
    if (f?.bind) {
      let r = f(v)
      env.setParam("output",r)
    }
  })
:}

/* все-таки мб ввести сигнал updated а там уж какой он был -changed или assigned - пусть от ячейки зависит
*/
feature "collect-history" {: env |
  let acc = []
  env.trackParam("input",(val) => {
    acc.push( val )
    env.setParam("output",acc.slice(0) ) // slice - чтобы оно менялось.. хех..
  })
:}

feature "show-needs" {
  root: visual_process 
  title="Просмотр Needs"
  url = "ws://127.0.0.1:12000"

  ~have-scene2d
  status="connecting"
  time_used=0
  tscale=0.0001
  scene2d={
    text @root.status style="color:lime;"
  }
  {
    gui {
      gui-tab "main" {
        gui-slot @root "url" gui={ |in out| gui-string @in @out }
        gui-slot @root "tscale" gui={ |in out| gui-slider min=0.0001 max=0.01 step=0.0001 @in @out }
      }
    }
    
    let ppk = (ppk-connect url=@root.url)
    m-eval {: o=@ppk st=(param @root "status") | st.set( o ? "connected" : "not connected") :}

    let runner_info = (ppk-query-many ["runner-info"] input=@ppk)
    let state=(m-eval {: return { nc: {}, rc: {}} :})
    
    //m-eval {: ri=@runner_info | console.log("ri=",ri) :}

    jsfunc "fix_time" {: ri state |
       if (ri && !state) { 
         console.error("ri is, state is not",ri,state)
       }
       if (!state) return
       if (state.t0 == null) state.t0 = ri.msg.timestamp
       ri.msg.timestamp_orig = ri.msg.timestamp
       ri.msg.timestamp -= state.t0
       return ri
    :}
    
    //func "getmsg" {: inp | return inp.msg :}

    let r_collected = (read @runner_info | fix_time @state asap=true | m-eval asap=true {: runner_info state=@state |
      if (!runner_info) return; // чет я не понимаю
      //console.log("runner_info arrived",runner_info)
      let rneeds = runner_info.msg.deployed_needs_ids
      let res = Object.keys( rneeds ).map( need_id => {
        let need_rec = rneeds[ need_id ]
        let runner_y = state.rc[ runner_info.msg.runner_id ]
        if (runner_y == null) {
          runner_y = state.rc[ runner_info.msg.runner_id ] = Object.keys(state.rc).length+1
        }
        let need_z = need_rec?.hint?.coview?.Z
        if (need_z == null) {
          if (state.nc[ need_id ] == null) {
            need_z = Math.random() * 10
            state.nc[ need_id ] = need_z
          } else need_z = state.nc[ need_id ]
        }
        //console.log("scope ppk is",this._.ppk)
        return { X: runner_info.msg.timestamp, Y: runner_y, Z: need_z, NEEDID: need_id, RUNNERID: runner_info.msg.runner_id }
      })
      return res
      // вычисляем массив положений нидсов
    :} | filter {: val | return val && val.length > 0 :} | collect-history | arr-flat)
    
    console_log "r=" @r_collected "needs=" @needs
    
    let needs = (df_create_from_rows input=@r_collected columns=["X","Y","Z"])
    cvneeds: cv_df (read @needs | df_mul X=@root.tscale) title="Таблица needs"

/*
    xx: let needs = (df_create | df_set X=0 Y=0 Z=0)
    reaction (param @r_append) {: needs_c = (param @xx "needs" |
    :}
*/
/*
    // что-то типа такого:
    create_from_arrays
    let needs = (df_create | df_set X=0 Y=0 Z=0)
    read @needs | df_append_rows @r_append | df_shallow_clone | write &needs
*/    

    //needs_pts: cv_points input=(read @needs | df_mul X=@root.tscale) title="Точки needs" radius=20
    needs_pts: cv_points input=@cvneeds.output title="Точки needs" radius=20

  }
}
