export function create_port_link( rapi, src_port, tgt_port ) {
  let link = src_port.map( (x,index) => rapi.create_link( x.id, tgt_port[index].id))

  link.destroy = () => console.log("todo: destroy link")
}
