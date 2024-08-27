
export function ch_bind_in_links( rapi, obj, api_to_attr, links_in )
{
	for (let local_name in links_in) {
		let sources = links_in[local_name]
		for (let ch_name of sources) {
			let q = rapi.query( ch_name ).done( msg => {
				let attr_name = api_to_attr[ local_name ]
				obj[ attr_name ].submit( msg.value );
			})
		}
	}
}

// links - список исходящих ссылок вида {"локальный-канал":["глобальный1","глобальный2",...]}
// в obj должны присутсвовать каналы
export function ch_bind_out_links( rapi, obj, api_to_attr, links )
{
	for (let local_name in links) {
		let globals = links[local_name]		
		let attr_name = api_to_attr[ local_name ]
		let unsub = obj[ attr_name ].subscribe( value => {
			for (let ch_name of globals) 
				rapi.msg( {label:ch_name,value})
		})
	}
}

export function ch_assign_attrs( obj,api_to_attr, params) {
	for (let name in params) {
		let attr = api_to_attr[ name ]
		if (attr) {
			obj[attr].submit( params[ name ] )
		}
	}
}