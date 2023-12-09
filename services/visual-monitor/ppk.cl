// первая версия с зависимостями

feature "ppk-connect" {
  root: object url = "ws://127.0.0.1:12000" id="web-client" {
    let rapi_module = (import_js (resolve_url "/client-api/repr-ws-client-api.js"))
    m-eval {: id=@root.id rapi_url=@root.url rapi_module=@rapi_module output_cell=(param @root "output") | 
      rapi_module.connect(id,rapi_url).then(rapi => {
        output_cell.set( rapi )
      })
    :}
  }
}

feature "ppk-query" {
  root: object "test" {
    m-eval {: ppk=@root.input crit=@root.0 output_cell=(param @root "output") obj=@root |
      //if (obj.unsub)
      ppk.query( crit ).done( msg => {
        output_cell.set( msg )
      })
    :}
  }
}

// read @ppk | ppk-query-many ["runner-info","runner-started","runner-finished"]
feature "ppk-query-many" {
  root: object "test" {
    m-eval {: ppk=@root.input critarr=@root.0 output_cell=(param @root "output") obj=@root |
      //if (obj.unsub)
      for (let crit of critarr) {
        ppk.query( crit ).done( msg => {
          //console.log("PPPPPKKKKK", msg )
          output_cell.set( { crit, tm:performance.now(), msg:msg} )
        })
      }
    :}
  }
}