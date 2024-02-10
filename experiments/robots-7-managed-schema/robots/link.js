// allow_loop - если порты по мощности не совпадают, создать циклическую связь
export function create( rapi, src_port, tgt_port, allow_loop ) {

  if (!src_port) {
    console.error("src_port is null! tgt_port=",tgt_port)
    console.trace();
  }

  if (!tgt_port) {
    console.error("tgt_port is null! src_port=",src_port)
    console.trace();
  }

  let link
  if (src_port.length == tgt_port.length) {
    link = src_port.map( (x,index) => rapi.create_link( x.id, tgt_port[index].id))    
  } else if (allow_loop) {
    if (src_port.length == 1) {
      link = tgt_port.map( (x,index) => rapi.create_link( src_port[0].id, tgt_port[index].id))
    } else console.error("create_port_link: not implemented case1")

  } else console.error("create_port_link: ports links count mismatch")

  link.destroy = () => console.log("todo: destroy link")

  return link
}