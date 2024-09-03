//import * as PPK from "/jsapi/client-api.js"
import * as PPK_REPR from "ppk/repr-ws-client-api.js"

export function start( repr_url ) {

if (!repr_url) {
  let params = new URL(document.location.toString()).searchParams;
  repr_url = params.get("repr_url");
}

console.log("connecting to repr, url=",repr_url);

PPK_REPR.connect( "bro", repr_url ).then( rapi => {
  console.log("connected to repr");
  //rapi.query("test").done(x => console.log("see in test:",x))

  let gui_ch_id = rapi.client_id + "/gui"
  rapi.query(gui_ch_id).done(guicmd => {
  	console.log("guicmd:",guicmd)
  	let v = guicmd.value;
  	create_object( rapi, v.description, v.target_id )
  	//
  })
  rapi.msg({label:"gui_attached",value:{"id":gui_ch_id}})
})

}

//console.log(333)

export function register( fn_dict )
{
  console.log("API: register",fn_dict)
  mia_types = {...mia_types,...fn_dict }
}

let mia_types = {};

let created_objects_ids = {}
export function create_object( rapi, description, target_id )
{
  	let fn = mia_types[ description.type ]
  	if (fn) {
  		let obj = fn( description, rapi )
  		
      if (description.id) {
        created_objects_ids[ description.id ] = obj
      }

      obj.append_to( created_objects_ids[target_id] || target_id )

  	} else {
  		console.error("cannot find fn for type",description.type)
  	}
}

// todo descr заменить на сразу items
export function create_children( rapi, obj, descr )
{
	let items = descr.items || []
	for (let k of items) {
		let c = create_object( rapi,k,obj)		
	}
}