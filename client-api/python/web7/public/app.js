//import * as PPK from "/jsapi/client-api.js"
import * as PPK_REPR from "/jsapi/repr-ws-client-api.js"

let params = new URL(document.location.toString()).searchParams;
let url = params.get("repr_url");

console.log("connecting to repr, url=",url);

// сильно упрощенное, чистый дом
function text( descr,rapi ) {
	console.log("text!",descr)
	let that = document.createElement("span")
	that["innerText"] = descr.params.value
	let obj = {}
	obj.append_to = tgt_id => {
		let tgt = document.getElementById( tgt_id )
		tgt.append( that )
	}
	obj.remove = () => {
		// todo: убрать все query q см ниже
	}

	let api_to_dom_attr = { "value" : "innerText"}

	let links_in = descr.links_in || {}
	for (let local_name in links_in) {
		let sources = descr.links_in[local_name]
		for (let ch_name of sources) {
			let q = rapi.query( ch_name ).done( msg => {
				let dom_attr_name = api_to_dom_attr[ local_name ]
				that[ dom_attr_name ] = msg.value;
			})
		}
	}

/*
	let links_out = descr.links_out || {}
	for (let local_name in links_out) {
		let sources = descr.links_out[local_name]
		for (let ch_name in sources) {

			rapi.query( ch_name ).done( msg => {
				that[ local_name ] = msg.value;				
			})
		}
	}
*/	

	return obj
}

let mia_types = { text }

PPK_REPR.connect( "bro", url ).then( rapi => {
  console.log("connected to repr");
  rapi.query("test").done(x => console.log("see in test:",x))

  let gui_ch_id = rapi.client_id + "/gui"
  rapi.query(gui_ch_id).done(guicmd => {
  	console.log("guicmd:",guicmd)
  	let v = guicmd.value;
  	let fn = mia_types[ v.description.type ]
  	if (fn) {
  		let obj = fn( v.description, rapi )
  		obj.append_to( v.target_id )
  	} else {
  		console.error("cannot find fn for type",v.description.type)
  	}
  	//
  })
  rapi.msg({label:"gui_attached",value:{"id":gui_ch_id}})
})



//console.log(333)
