#!/usr/bin/env node

//import { URL } from 'url'; // in Browser, the URL in native accessible on window
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

import * as fs from 'node:fs';
import process from 'node:process';
import * as querystring from 'node:querystring'
let verbose = process.env.VERBOSE;

/////////////////////////////////////
import {ListManager} from "./lm.js"
let LM = new ListManager()
/////////////////////////////////////

import {PPKWebsocketServer} from "./features/ws-server.js"
let PPK_WS = new PPKWebsocketServer( LM, 10000, process.env.VERBOSE )

import * as PPK from "ppk"
PPK.prefix_console_log( () => ["[main]",performance.now()] )

///////////////////////////////////// запуск программы пользователя из аргумента
/* признано чухней

let user_script = process.argv[2]
if (user_script) {
	console.log("importing",user_script)
	import(user_script).then( modul => {
	})
}
*/

//////////////////////////////////// старт сервисов по запросу
/*
import * as PPK from "ppk/client-api.js"
import req_init from "ppk/req.js"
import * as cp from 'node:child_process'
PPK.prefix_console_log( () => ["[main]",performance.now()] )
PPK.connect("main").then( rapi => {  
  let req_api = req_init( rapi, rapi.query )
  rapi.request = req_api.request.bind( req_api )
  rapi.reply = req_api.reply.bind( req_api )

  let started = {}

  rapi.query("start-on-main").done( (msg) => {
  	console.log("start-on-main",msg)
  	if (!msg.guid) 
  		msg.guid = `main_process_${Object.keys(started).length}`

	if (started[msg.guid]) 
		return rapi.reply( msg,true) // вообще надо дожидаться inited
    
    let ppath = path.resolve( path.resolve( __dirname,".." ), msg.path )
    console.log("spawning path=",ppath,"args=",msg.args)
    let prg = cp.spawn( ppath, msg.args || {})
    started[msg.guid] = prg

    prg.stderr.on('data', (data) => {
	    let s = data.toString('utf8')
	    console.log(msg.guid,"stderr",s)
    })
	prg.stdout.on('data', (data) => {
	      let s = data.toString('utf8')
	      console.log(msg.guid,s)
	      if (started[msg.guid].inited) return

	      if (s.indexOf("started") >=0 ) {
	      	started[msg.guid].inited = true
	      	rapi.reply( msg,true)
	      }
	})
	prg.on('error', (data) => {
	    console.log(msg.guid,`subprocess error [${prg.pid}] `,"error:",data)
	});
  })

  function stop() {
    for (let k of Object.values( started ))
    	k.kill()
  }

    process.on('uncaughtException', err => {
      stop()
    })
    process.on('exit', err => {
      stop()
    })
    // реакция на ctrl+C
    process.on('SIGINT', err => {
      stop()
      process.exit()
    })      
})
*/
