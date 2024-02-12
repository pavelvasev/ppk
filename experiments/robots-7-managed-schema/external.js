#!/usr/bin/env -S node

// external - добавляем процессы через списковое апи

import * as PPK from "ppk"

PPK.connect("test").then( rapi => {
  //console.log('rapi connected',rapi)
  let stop = rapi.start_process("compute",{},"pr_list","compute1")
  let stop2 = rapi.start_process("vis",{},"pr_list","vis1")
  let stop3 = rapi.start_process("link_process",{src:"compute1/output",tgt:"vis1/input"},"pr_list","link1")
})
