//import * as PPK from "/jsapi/client-api.js"
import * as PPK_REPR from "/jsapi/repr-ws-client-api.js"
import * as THREEJS_FEATURE from "./threejs-feature.js"
import * as DOM_FEATURE from "./dom-feature.js"

let params = new URL(document.location.toString()).searchParams;
let url = params.get("repr_url");

console.log("connecting to repr, url=",url);


PPK_REPR.connect( "bro", url ).then( rapi => {
  console.log("connected to repr");
  rapi.query("test").done(x => console.log("see in test:",x))

  let gui_ch_id = rapi.client_id + "/gui"
  rapi.query(gui_ch_id).done(guicmd => {
  	console.log("guicmd:",guicmd)
  	let v = guicmd.value;
  	create_object( rapi, v.description, v.target_id )
  	//
  })
  rapi.msg({label:"gui_attached",value:{"id":gui_ch_id}})
})

//console.log(333)

let mia_types = { ...DOM_FEATURE.types,...THREEJS_FEATURE.types };

export function create_object( rapi, description, target_id )
{
  	let fn = mia_types[ description.type ]
  	if (fn) {
  		let obj = fn( description, rapi )
  		obj.append_to( target_id )
  	} else {
  		console.error("cannot find fn for type",description.type)
  	}
}

export function create_children( rapi, obj, descr )
{
	let items = descr.items || []
	for (let k of items) {
		let c = create_object( rapi,k,obj)		
	}
}