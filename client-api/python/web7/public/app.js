//import * as PPK from "/jsapi/client-api.js"
import * as PPK_REPR from "/jsapi/repr-ws-client-api.js"

let params = new URL(document.location.toString()).searchParams;
let url = params.get("repr_url");
console.log("connecting to repr, url=",url);
PPK_REPR.connect( "bro", url ).then( rapi => {
  console.log("connected to repr");
  rapi.query("test").done(x => console.log("see in test:",x))
})

//console.log(333)