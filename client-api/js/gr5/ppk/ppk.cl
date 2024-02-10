// первая версия с зависимостями

import repr="js:../ppk/repr-ws-client-api.js"

process "connect" {
  in {
    url: cell "ws://127.0.0.1:12000"
    id: cell "web-client"    
  }
  //status: cell "pending"
  output : cell

  apply {: id url |

    connect_reconnect()

    function connect_reconnect() {
      let rapi = repr.connect( id, url )

      rapi.then( rapi => {
        output.submit( rapi )

        rapi.closed.then( () => {
          //output.submit( null )
          // нельзя ее занулять.. только делать не-назначенной как-то
          // а то к ней там прицепились уже
          setTimeout( connect_reconnect, 1000 )
        })

      }).catch( error => {
        setTimeout( connect_reconnect, 2000 )
      })
    }
  :} @id @url  
}

/*
process "connect" {
  in {
    url: cell "ws://127.0.0.1:12000"
    id: cell "web-client"    
  }
  //status: cell "pending"
  output := apply {: id url |
    let rapi = repr.connect( id, url )    
    return rapi
  :} @id @url @reconnect| read_promise

  reconnect : cell 0

  react (get @output "closed") {:
    console.log("rapi connect closed. reconnecting in 1 second ...")
    setTimeout( () => reconnect.submit( reconnect.get()+1), 1000 )
  :}
}
*/

process "query" {
  in {
    rapi: cell
    label: cell
  }
  output: channel

  apply {: rapi label |
    
    rapi.query( label ).done( msg => {
      output.submit( msg )
    })
  :} @rapi @label
}

process "shared" {
  in {
    rapi: cell
    label: cell
  }
  output: channel

  apply {: rapi label |    
    rapi.shared( label ).subscribe( values => {
      output.submit( values )
    })
  :} @rapi @label
}

process "shared_writer" {
  in {
    rapi: cell
    label: cell
    input: cell
    id: cell null
  }

  apply {: rapi label id |
    let writer = rapi.shared_list_writer( label, {id} )
    input.subscribe( value => {
      writer.submit( value )
    })
  :} @rapi @label @id
}