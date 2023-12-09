#!/usr/bin/env node

/* Назначение:
     - раздавать файлы из папок
     - проксировать чтение пейлоадов из пуши

   Возможно:
     - проксировать посылку сообщений от веб-клиентов другим клиентам?
       (т.е. этот сервер выступает проксей)
     - быть приемщиком сообщений по хттп для веб-клиента? и пересылать ему по ws?
       или это уже в мейн отдать?
*/

import url from 'node:url';
import * as http_m from 'http';
import mime from 'mime'
import * as path from 'node:path'
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';

function prefix_console_log( fn ) {
  var originalConsoleLog = console.log;
  console.log = function() {
      let args = fn();
      // Note: arguments is part of the prototype
      for( var i = 0; i < arguments.length; i++ ) {
          args.push( arguments[i] );
      }
      originalConsoleLog.apply( console, args );
  };
}

prefix_console_log( () => ["[http-file-server]",performance.now()] )

start_message_server( process_incoming ).then( res => {
  // console.log('visual debug:',`${res.my_endpoint_url}/vd`)
})

function start_message_server( process_incoming,port=8000,host='0.0.0.0',allow_find_free_port=false ) {
    let server = http_m.createServer( {keepAlive: true},process_incoming )
    //httpClose({ timeout: 2000 }, server)
        
    server.keepAliveTimeout = 70*1000
    
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (allow_find_free_port) {
          console.log('Address in use, retrying...');
          port = port+1;
          server.listen( port,host );
        }
        else {
          throw e
        }
      }
    });

    server.listen( port,host );

    return new Promise( (resolve, reject) => {

      server.on("listening",() => {
        console.log('http-file-server started at:', server.address());
        //console.log('http server started: http://%s:%s', server.address().address, server.address().port);
        //server.address().address
        let adr = '127.0.0.1'
        let my_endpoint_url = `http://${adr}:${server.address().port}`
        console.log('http-file-server started at',my_endpoint_url)
        resolve( {server,my_endpoint_url} )
      });

    })
}    

/////////////////////////////////////////////
///////////////////////////////////////////// история про агентов и сокс-прокси
/////////////////////////////////////////////

const proxy_httpAgent = new http_m.Agent({
    keepAlive: true, timeout: 120*1000,
    scheduling: 'fifo',
    maxSockets: 4 // сколько одновременно сообщений 1 хосту мы можем посылать
});

import { SocksProxyAgent } from 'socks-proxy-agent';
let proxy_agents={}
function get_or_create_agent_on( socks_proxy_url ) {
  proxy_agents[socks_proxy_url] ||= new SocksProxyAgent(
    socks_proxy_url,
    {
      keepAlive: true, 
      timeout: 60*1000,
      scheduling: 'fifo',
      maxSockets: 4 // сколько одновременно сообщений 1 хосту мы можем посылать
    }
  );
  return proxy_agents[socks_proxy_url]
}

// это опция говорит о том, что мы хотим скачивать (проксировать) удаленные пейлоады
// для этого нам надо идти на сокс-проксю
if (process.env["PPK_SOCKS_LOCK2"]) {
  let PPK_SOCKS_LOCK = process.env["PPK_SOCKS_LOCK2"]
  // proxy_fn - по target_url возвращает урль прокси, если он нужен для доступа к target_url из текущего местоположения
  global.proxy_fn = (target_url) => {  
      let addr = target_url.split("://")[1]
      if (!addr.startsWith("127.0"))
          return PPK_SOCKS_LOCK // доступ из УМТ к лок. машине..
  }
}

//let my_addr = process.env["PPK_PUBLIC_ADDR"] || "127.0.0.1"
function get_agent_for( url ) {
  let proxy_fn = global.proxy_fn // ужасный хак, но пока так
  if (proxy_fn) {
    let proxy_addr = proxy_fn( url )
    // console.log("proxy_addr computed:",proxy_addr,"for url",url)
    if (proxy_addr)
        return get_or_create_agent_on( proxy_addr )
  }  
  //url_addr = url.split("://")[1]
  return proxy_httpAgent
}

/////////////////////////////////////////////
/////////////////////////////////////////////
/////////////////////////////////////////////

function process_incoming( request, response ) {
  let u = new url.URL( request.url, 'https://example.org/' )

    if (request.headers.origin) {
        //const u =  url.parse ( request.headers.referer );
        response.setHeader( "Access-Control-Allow-Origin",request.headers.origin ); // F-REQESTER-CORS
        response.setHeader( "Access-Control-Allow-Headers","Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, If-Modified-Since, ETag" );
        response.setHeader( "Access-Control-Allow-Methods","GET,HEAD,OPTIONS,POST,PUT" );
        response.setHeader( "Access-Control-Allow-Private-Network","true")
    }

  // используется для чтения пейлоадов..
  if (u.pathname == "/proxy") {
    if (request.method == "OPTIONS") {
            response.writeHead(200);
            response.end("ok")    
            return
    }
    let urla = u.searchParams.get("url")
    console.log("proxy: issuing proxy request to url",urla)
    // прокси.. вестимо на пейлоад.. используем спец-агента чтобы были кипалайвы
    let proxy_req = http_m.request(urla,{agent: get_agent_for( urla )}, (proxy_resp) => {
      let h = {...proxy_resp.headers}
      delete h['connection']
      delete h['keep-alive']
      console.log("proxy: ok see callback called",proxy_resp.statusCode, proxy_resp.headers,"piping headers",h)
      response.writeHead(proxy_resp.statusCode, h);

      console.time("pipe")
      console.time("client-pipe")
      proxy_resp.on("end",() => {
        console.timeEnd("pipe")
      })
      response.on("finish",() => {
        console.timeEnd("client-pipe")
      })
      
      proxy_resp.pipe( response )      
    })
    proxy_req.on('error', (e) => {
      console.error(`proxy: problem with request: ${e.message}`);
    });
    proxy_req.end()
    return
  }
  let parts = u.pathname.split("/")

  let fname = path.join( ".",parts.join("/") )
  //console.log({parts,fname,urla:u.pathname})
  //console.log({parts,fname,urla:u.pathname})
  console.log(u.pathname)

  fsp.open( fname ).then( fh => {
    fh.stat().then( stat => {
      //console.log("stat resolved to",stat)
      response.setHeader( 'Pragma', "no-cache" )
      response.setHeader( 'Expires', "0" )

      if (stat.isDirectory()) {
            response.setHeader( 'Content-Type', "text/html" )

            response.writeHead(200);
            response.end("This is directory")
      }
      else
        if (stat.isFile()) {
            let s = fh.createReadStream()
            let mt = mime.getType( fname );  
            response.setHeader( 'Content-Type', mt )
            s.pipe( response )
        }
        else {
            response.setHeader( 'Content-Type', "text/html" )
            response.writeHead(400);
            response.end("This is what?")
        }

    })
  }).catch( err => {
      response.setHeader( 'Content-Type', "text/html" )
      response.writeHead(400);
      response.end(`Error opening path: ${err.message}`)
      console.error(err)
  })

/*
  s.on('error',(err) => {
            console.log("body stream error")
            response.writeHead(400);
            response.end()
          })*/

  //let st = fs.lstatSync(fname)
  //if (!st.exi)
  //if (fs.lstatSync(fname).isDirectory() 
  /*
  let s = fs.createReadStream( fname );
  let mt = mime.getType( fname );  
  response.setHeader( 'Content-Type', mt )
  s.pipe( response )
  s.on('error',(err) => {
            console.log("body stream error")
            response.writeHead(400);
            response.end()
          })
  */        
}