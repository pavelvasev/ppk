#!/usr/bin/env -S node

// external - добавляем процессы через списковое апи

import * as PPK from "ppk"

function submit() {
  PPK.connect("test").then( rapi => {
    //console.log('rapi connected',rapi)
    console.log("sending processes...")
    let stop = rapi.start_process("compute",{},"pr_list","compute1")
    let stop2 = rapi.start_process("vis",{},"pr_list","vis1")
    //let stop3 = rapi.start_process("link_process",{src:"compute1/output",tgt:"vis1/input"},"pr_list","link1")
    //let stop3 = rapi.start_port_link("compute1/output","vis1/input","pr_list","link1")
    let stop3 = rapi.start_process("link_process",{src:"compute1/output",tgt:"vis1/input"},"pr_list","link1")

    rapi.ws.on("close",() => {
      submit()
    })
  }, (err) => {
    console.log("see connect error. going to reconnect in 1 second.")
    setTimeout( submit, 1000 )
  })
}

submit()