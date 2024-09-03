import * as CL2 from "ppk/cl2.js"
import * as API from "web7/app.js"
import * as UTILS from "web7/utils.js"


function create_dom_obj( tag_name ) {
	let that = document.createElement(tag_name)
	
	let obj = {dom_node: that}
	obj.append_to = tgt_id => {	
		let tgt = tgt_id.dom_node ? tgt_id.dom_node : document.getElementById( tgt_id )
		tgt.append( that )
	}
	obj.release = CL2.create_channel()
	obj.remove = () => {
		obj.release.submit()
	}

	return obj
}

function assign_attrs( obj,api_to_dom_attr, params) {
	let has_value_attr = false;
	for (let name in params) {		
		let dom_attr = api_to_dom_attr[ name ]
		if (dom_attr == "value") { has_value_attr = name; continue; }
		if (dom_attr) {
			obj.dom_node[dom_attr] = params[ name ]
		}
	}
	// поле типа .value надо присваивать последним, иначе например attr не отрабатывает
	if (has_value_attr) {
		let dom_attr = api_to_dom_attr[ has_value_attr ]
		obj.dom_node[dom_attr] = params[ has_value_attr ]
	}
}

function bind_in_links( rapi, obj, api_to_dom_attr, links_in )
{
	for (let local_name in links_in) {
		let sources = links_in[local_name]
		for (let ch_name of sources) {
			let q = rapi.query( ch_name ).done( msg => {
				let dom_attr_name = api_to_dom_attr[ local_name ]
				obj.dom_node[ dom_attr_name ] = msg.value;
			})
		}
	}
}

/////////////////////////////

////////////////////////////////////

// 	let api_to_dom_attr = { "value" : "innerText"}
function create_dom_c( rapi, tagname, api_to_dom_attr, descr, patch_fn ) {
	
	let obj = create_dom_obj(tagname)
	if (patch_fn) patch_fn(obj)
	assign_attrs( obj, api_to_dom_attr, descr.params);
	bind_in_links( rapi, obj, api_to_dom_attr, descr.links_in || {} )
	UTILS.ch_bind_out_links( rapi, obj,api_to_dom_attr, descr.links_out || {})
	API.create_children( rapi, obj, descr )

	return obj
}

function create_dom_ch( rapi, tagname, api_to_dom_attr, descr, patch_fn ) {
	
	let obj = create_dom_obj(tagname)
	if (patch_fn) patch_fn(obj)
	UTILS.ch_assign_attrs( obj, api_to_dom_attr, descr.params);
	UTILS.ch_bind_in_links( rapi, obj, api_to_dom_attr, descr.links_in || {} )
	UTILS.ch_bind_out_links( rapi, obj,api_to_dom_attr, descr.links_out || {})
	API.create_children( rapi, obj, descr )

	return obj
}

function dom_event_channel( obj, dom_node, event_name, convertor_fn ) {
	let forget = () => {}
	let tgt_channel = CL2.create_channel()

	if (!convertor_fn) convertor_fn = () => true;

    function handler(arg) 
    {
    	let val = convertor_fn(arg)    	
        tgt_channel.submit( val )
    }

    dom_node.addEventListener( event_name, handler )            
    forget = () => {
        dom_node.removeEventListener( event_name, handler )
        forget = () => {}
    }

    obj.release.subscribe( () => forget() )
    return tgt_channel
}

function dom_attr_channel( obj, dom_node, attr_name ) {
	let forget = () => {}
	let tgt_channel = CL2.create_channel()

	forget = tgt_channel.subscribe( x => {
		dom_node[attr_name] = x
	})
    
    obj.release.subscribe( () => forget() )
    return tgt_channel
}

// сильно упрощенное, чистый дом
// похоже достигнут некий предел тут.. и надо делать классы.. ну ок..
function text( descr,rapi ) {
	let api_to_dom_attr = { "value" : "innerHTML"}
	return create_dom_c( rapi,"span",api_to_dom_attr,descr );	
}

function button( descr,rapi ) {
	let api_to_dom_attr = { "value" : "innerText","click":"click"}
	return create_dom_c( rapi,"button",api_to_dom_attr,descr,(obj) => {		
		obj.click = dom_event_channel( obj,obj.dom_node,"click" )
	} );
}

function combobox( descr,rapi ) {
	let api_to_dom_attr = { "value" : "value","change":"change","values":"values"}
	return create_dom_ch( rapi,"select",api_to_dom_attr,descr,(obj) => {		
		obj.change = dom_event_channel( obj,obj.dom_node,"change",x => parseInt(x.target.value) )
		obj.value = dom_attr_channel( obj, obj.dom_node,"value")
		obj.values = CL2.create_channel()
		obj.values.subscribe( list => {
			obj.dom_node.options.length = 0;
			for (let i=0; i<list.length; i++) {			
				const opt = document.createElement("option");
				opt.value = i;
				opt.text = list[i];
				obj.dom_node.add( opt );
			}			
		})
	} );
}

function checkbox( descr,rapi ) {
	let api_to_dom_attr = { "value" : "setval", "text": "settxt"}
	return create_dom_c( rapi,"label",api_to_dom_attr,descr,(obj) => {
		let that = document.createElement("input")
		that.setAttribute("type", "checkbox");
		obj.dom_node.appendChild( that )
		obj.changed = dom_event_channel( obj,that,"change",x => x.target.checked )
		obj.setval = CL2.create_channel();
		obj.setval.subscribe( v => that.checked = v)

		let txt = document.createElement("span")
		obj.settxt = CL2.create_channel();
		obj.settxt.subscribe( t => txt.innerHTML = t )
		// еще можно obj.node_obj.nodeValue попробовать
	} );
}

function slider( descr,rapi ) {
	const stop = function(e) {
	    e.preventDefault();
	    e.stopImmediatePropagation();
	};

	let api_to_dom_attr = { "value" : "value",
	    "change":"change","interactive_change":"interactive_change",
	    "min":"min","max":"max","step":"step"}
	return create_dom_c( rapi,"input",api_to_dom_attr,descr,(obj) => {
		obj.dom_node.setAttribute("type", "range");
		//obj.click = dom_event_channel( obj,"click" )
		// https://stackoverflow.com/questions/69490604/html-input-range-type-becomes-un-usable-by-drag-action-if-highlighted-in-chrome
		// bugfix
		obj.dom_node.draggable = true;
    	obj.dom_node.addEventListener('dragstart', stop);

    	obj.change = dom_event_channel( obj,obj.dom_node,"change",(x)=>x.target.valueAsNumber )
    	obj.interactive_change = dom_event_channel( obj,obj.dom_node,"input",(x)=>x.target.valueAsNumber )
	} );
}

function box( descr,rapi ) {
	return create_dom_c( rapi,"div",{},descr );
}

function row( descr,rapi ) {
	return create_dom_c( rapi,"div",{},descr,(obj) => {
		obj.dom_node.own_style = "display: flex; flex-direction: row;"
		obj.dom_node.style = obj.dom_node.own_style
	})
}

function column( descr,rapi ) {
	return create_dom_c( rapi,"div",{},descr,(obj) => {
		obj.dom_node.own_style = "display: flex; flex-direction: column;"
		obj.dom_node.style = obj.dom_node.own_style;
	})
}

function grid( descr,rapi ) {
	return create_dom_c( rapi,"div",{},descr,(obj) => {
		obj.dom_node.own_style = "display: grid;"
		obj.dom_node.style = obj.dom_node.own_style
	})
}

////////////// модификаторы пробуем
export function bgcolor( descr,rapi ) {
	let api_to_attr = { value:"value" }

	let obj = {}
	let tgt
	obj.append_to = tgt_id => {
		tgt = tgt_id.dom_node || document.getElementById( tgt_id )
		UTILS.ch_assign_attrs( obj,api_to_attr, descr.params )
	}
	obj.remove = () => {	
	}
	obj.release = CL2.create_channel()

	obj.value = CL2.create_channel()
	obj.value.subscribe( x => {
		if (!tgt) return
		tgt.style.backgroundColor = somethingToColorDom(x);
	})	

	UTILS.ch_bind_in_links( obj, api_to_attr, descr.links_in || {} )

	return obj
}

function somethingToColorDom( c )
{
    if (Array.isArray(c) && c?.length == 3)
    	return `rgba(${c[0]*255},${c[1]*255},${c[2]*255},1)`;
    return c;
}

export function textcolor( descr,rapi ) {
	let api_to_attr = { value:"value" }

	let obj = {}
	let tgt
	obj.append_to = tgt_id => {
		tgt = tgt_id.dom_node || document.getElementById( tgt_id )
		UTILS.ch_assign_attrs( obj,api_to_attr, descr.params )
	}
	obj.remove = () => {		}
	obj.release = CL2.create_channel()

	obj.value = CL2.create_channel()
	obj.value.subscribe( x => {
		if (!tgt) return
		tgt.style.color = somethingToColorDom(x);
	})	

	UTILS.ch_bind_in_links( obj, api_to_attr, descr.links_in || {} )

	return obj
}

export function padding( descr,rapi ) {
	let api_to_attr = { value:"value" }

	let obj = {}
	let tgt
	obj.append_to = tgt_id => {
		tgt = tgt_id.dom_node || document.getElementById( tgt_id )
		UTILS.ch_assign_attrs( obj,api_to_attr, descr.params )
	}
	obj.remove = () => {		}
	obj.release = CL2.create_channel()

	obj.value = CL2.create_channel()
	obj.value.subscribe( x => {
		if (!tgt) return
		tgt.style.padding = x + "px"
	})	

	UTILS.ch_bind_in_links( obj, api_to_attr, descr.links_in || {} )

	return obj
}

/* это наивная добавлялка css
   idea улучшенная добавлялка позволит делать несколько тегов add_css
   либо сделает для add_css сбор детей сначала
   но вообще это уже про тему модификаторов
   и мб классы эффективнее
   в обжем жизнь покажет
*/
export function set_css_style( descr,rapi ) {
	let api_to_attr = { value:"value" }

	let obj = {}
	let tgt
	obj.append_to = tgt_id => {
		tgt = tgt_id.dom_node || document.getElementById( tgt_id )
		UTILS.ch_assign_attrs( obj,api_to_attr, descr.params )
	}
	obj.remove = () => {}
	obj.release = CL2.create_channel()

	obj.value = CL2.create_channel()
	obj.value.subscribe( x => {
		if (!tgt) return
		let style_prefix = tgt.own_style || ""	
		//console.log("")
		tgt.style = `${style_prefix};${x}`;
	})	

	UTILS.ch_bind_in_links( obj, api_to_attr, descr.links_in || {} )

	return obj
}

export let types = {textcolor,bgcolor,text,row,column,grid,box,button,
   slider,add_style:set_css_style,padding,combobox,checkbox}
