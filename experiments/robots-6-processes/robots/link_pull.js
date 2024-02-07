/* специальная ссылка - передает данные между портами 
   однократно по запросу на спец-канал
*/

import * as VIS5 from "./vis_pass_5.js"
import * as LINK from "./link.js"

// worker_ids - места где возникают сигналы src_port
// туда будет назначена обработка
let id_counter = 0
export function create( rapi, src_port, tgt_port, worker_ids, id ) {

  id ||= "pull_link_"+(id_counter++)

  if (!src_port) {
    console.error("pull_link: src_port is null! tgt_port=",tgt_port)
    console.trace();
  }

  if (!tgt_port) {
    console.error("pull_link: tgt_port is null! src_port=",src_port)
    console.trace();
  }

  if (src_port.length != tgt_port.length) {
    console.error("pull_link: ports links count mismatch")
    return null
  }

  let passing_robot = VIS5.robot( rapi, id+"/vis5", worker_ids )

  LINK.create( rapi, src_port, passing_robot.input )
  LINK.create( rapi, passing_robot.output, tgt_port )

  let link = {}

  link.destroy = () => console.log("todo: destroy link")

  link.control = passing_robot.control

  return link
}