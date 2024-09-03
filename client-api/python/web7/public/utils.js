
export function ch_bind_in_links( rapi, obj, api_to_attr, links_in )
{
	//console.log("ch_bind_in_links:",links_in)
	for (let local_name in links_in) {
		let sources = links_in[local_name]
		let attr_name = api_to_attr[ local_name ]
		if (attr_name) {
			for (let ch_name of sources) {
				//console.log("ch_bind_in_links: query ",ch_name)
				let q = rapi.query( ch_name ).done( msg => {
					//console.log("eeee msg!",msg)
					obj[ attr_name ].submit( msg.value );				
				})
			}
		}
		else
			console.error("ch_bind_in_links: cannot find attr for param=",local_name,"of object",obj)
	}
}

// links - список исходящих ссылок вида {"локальный-канал":["глобальный1","глобальный2",...]}
// в obj должны присутсвовать каналы
export function ch_bind_out_links( rapi, obj, api_to_attr, links )
{
	for (let local_name in links) {
		let globals = links[local_name]		
		let attr_name = api_to_attr[ local_name ]
		if (attr_name)
		{
			let unsub = obj[ attr_name ].subscribe( value => {
				for (let ch_name of globals)
					rapi.msg( {label:ch_name,value})
			})
		} else console.error("ch_bind_out_links: cannot find attr for param=",local_name,"of object",obj)
	}
}

// api_to_attr - таблица вида "апи-имя" -> "локальное-имя"
export function ch_assign_attrs( obj,api_to_attr, params) {
	for (let name in params) {
		let attr = api_to_attr[ name ]
		if (attr) {
			obj[attr].submit( params[ name ] )
		} else console.error("ch_assign_attrs: cannot find attr for param=",name,"of object",obj)
	}
}