// первая версия с зависимостями

import repr="js:../ppk/repr-ws-client-api.js"

process "connect" {
  in {
    url: cell "ws://127.0.0.1:12000"
    id: cell "web-client"    
  }
  //status: cell "pending"
  output := apply {: id url |
    return repr.connect( id, url )
  :} @id @url | read_promise
}

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