export function create_port_link( rapi, src_port, tgt_port ) {

  if (!src_port) {
    console.error("src_port is null! tgt_port=",tgt_port)
    console.trace();
  }

  if (!tgt_port) {
    console.error("tgt_port is null! src_port=",src_port)
    console.trace();
  }  

  let link = src_port.map( (x,index) => rapi.create_link( x.id, tgt_port[index].id))

  link.destroy = () => console.log("todo: destroy link")
}
