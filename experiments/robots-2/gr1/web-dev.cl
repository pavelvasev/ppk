#!/usr/bin/env -S clon run

print "starting web dev"

import os="std/os.cl"

func "compile" {
  k1: os.spawn "clon" "compile" // stdio="inherit"
  react @k1.stdout { msg | print @msg }
  //react @k1.stderr { msg | print "ERR" @msg }
  errs := read @k1.stderr | gather_events
  react @k1.exitcode {: code |
    //print "compile finished"
    // можно также задать переменную и считывать ее в index.html
    if (code != 0) {
      console.log("compile error", errs.get(),'writing to file')
      os.write("main.cl.js",`export function create_main() {
        let elem = document.createElement("pre")
        elem.style.cssText = "background: black; color: white; padding: 10px;"
        elem.textContent=\`${errs.get().toString().replaceAll("\`","").replaceAll("\$","")}\`;
        return { output: { subscribe: ( fn ) => fn( elem )}}
      }`)
    }
  :}
  return @k1.exitcode
}

compile

================


// запускаем лайв-сервер который обновляет веб-страницу при изменении файлов
// проект https://github.com/tapio/live-server
// os.spawn "npx" "--yes" "live-server" stdio="inherit"
// другой вариант: https://vitejs.dev/guide/
os.spawn "npx" "--yes" "vite" "--open" stdio="inherit"
// но тогда сказать npm init; npm install vite

// запускаем перекомпиляцию при изменении файлов
//os.spawn "clon" "watch" stdio="inherit"

print "entering wait state"
import std="std"
react (os.watch "..") { val |
     print "watch reaction! " @val
     if (apply {: return val.filename.endsWith(".cl") :}) {
       print "watch reaction - recompile! " @val
       return (compile)
     }
}