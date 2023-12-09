#!/usr/bin/env -S node --experimental-fetch 

// Сервис хранений нагрузок "Пуща"

// на базе
// https://github.com/pavelvasev/pusha/blob/master/bin/pusha.js

/* протокол
   get http://..../N - выдать блок номер N
   get http://..../list - выдать список блоков
   post http://..../ - загрузить блок
   get http://..../N?push=http://..../ - провести загрузку блока в другую пушу

*/

/*
   потребности
   * сохранять расширение файла чтобы при запросе браузера делался норм content-type
     в духе загрузки картинки или json-ки или js
   это не потребность!!!!! это способ. а потребность - отдавать контент тайп.
   сделаем для прощения что коннент-тайп пусть клиент присылает в урле.  
   F-NEED-CONTENT-TYPE

   https://web.dev/i18n/ru/fetch-upload-streaming/

   отличия от старой пуши
   - имена файлам придумывает она сама, это чиселки, как следствие не хранит контент-тайп
   и при загрузке возвращает имя файла. т.о. не клиент определяет имя а сервер а клиент получает
   возможность построить урль как забирать файл
   - список сделан на /
   - при выгрузке файла можно указать его контент-тайп, напр http://127.0.0.1:3333/0?ct=text/plain 

   идея - доабвить режим append... т.е. не просто пишем но аппендим. мб пригодится для хранения логов и т.п.
   но получается уже указываем файл к которому аппендим.
   но тогда надо относится к пейлоадам/файлам не как к временному пристанищу, а как к хранимому.
   и сообразно выделять им не номера а гуиды уникальные. или еще как-то обеспечивать их постоянство.
   сейчас же пуща пишет поверх при каждом запуске.

*/

import * as PPK from "ppk"
PPK.prefix_console_log( () => ["[pusha]",performance.now()] )


process.on('unhandledRejection', (reason, promise) => {
  console.log('pusha: Unhandled rejection reason:', reason);
  // uhr_handler(reason); uhr_handler = () => {}
  // console.log('runner: Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});
// todo там проблемы со stat надо получше это ловить наверное
/*
process.on('uncaughtException', (reason, origin) => {
  console.log('pusha: uncaughtException reason:', reason);
  // uhr_handler(reason); uhr_handler = () => {}
  // console.log('runner: Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});
*/


// выдача по http get через send
// аплоад прямой
// push

/* TODO
   симолы / в имени данных (каталоги)
*/

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

var http = require('http');
// вроде можно заменить на чтение файла и отправку так..
// var send = require('send'); // https://github.com/pillarjs/send
var url = require('url');
//var Busboy = require('busboy'); // https://github.com/mscdex/busboy
var path = require('path');
var fs = require('fs');
var glob = require("glob"); // https://www.npmjs.com/package/glob
//var request = require('request');

var config = require(process.argv[2] || "./pusha-conf.json");
// интересно что ./ загружается относительно файла а не текущей директори..

//var config =  JSON.parse(fs.readFileSync( process.argv[2] || "./conf.json", "utf8"));
//var config =  JSON.parse('{ "dir": "qqq" }');
// json stream http://stackoverflow.com/a/17567608

console.log( "config.dir=",config.dir, "resolved to",path.resolve(config.dir) );

if (!fs.existsSync(config.dir)) {
  console.log("config.dir not exist! making:",config.dir);
  fs.mkdirSync(config.dir);
  //process.exit(1);
}
if (!fs.statSync(config.dir).isDirectory())
{
  console.log("config.dir is not a dir! exiting.");
  process.exit(1);
}

let file_counter = 0
var app = http.createServer({ keepAlive: true }, function(req, res){
  var urla = url.parse(req.url,true);

  req.on('error',(err) => {
    console.error('request error',err)
  })
  res.on('error',(err) => {
    console.error('response error',err)
  })  
  
  /// аплоад
  
  if (req.method === 'POST') {
    //console.log(req.headers);
    //var saveTo = path.join(config.dir, urla.pathname );
    //let saveTo = (file_counter++).toString()
    let fname = (file_counter++).toString()
    let saveTo = path.join(config.dir, fname );
    console.log("streaming into:",saveTo);
    
    //var typ = req.headers['content-type'] || "";
    //console.log("direct upload, typ=",typ)

    var x
    try {
     x = fs.createWriteStream( saveTo );

      // отвечаем сразу
      //fetch на клиенте в ноде от этого ломается, todo перейти с фетч на другое клиент или вообще на сокеты 
       //res.writeHead(200);
        //res.write(`/${fname}`)
        //res.end(`/${fname}`);
            
      //console.time("stream-in")
      let streaming_key = `stream-in-${fname}-${process.env.PPK_PUBLIC_ADDR}<-${req.socket.remoteAddress}`
      console.time( streaming_key )

      let t1 = performance.now()
      //req.on('end',() => {
      // таки ждем когда именно файл запишут а не то что запрос закончился
      // а то выясняется что запрос кончился а файл еще не профлашился а его уже у нас запрашивают
      // https://nodejs.org/api/stream.html#event-finish 
      x.on('finish',() => {

        console.timeEnd( streaming_key )
        //console.timeEnd("stream-in")
        res.writeHead(200);
        res.end(`/${fname}`);
        
        let stat = fs.statSync( saveTo )
        console.log("stream(t-manual)-in: ",performance.now()-t1,"ms, size", stat.size.toString())        

        // плюс это видимо нам некая гарантия того что мы данные запишем и ток потом их будут использовать
        // ну и в целом оно что-то валится если не так делать, не знаю почему. мб на сокетах попробовать.
        //res.end();
      })

      return req.pipe(x);

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain'} );          
      res.end( err.message )
      console.error( err )      
    }
    return
  }

  /// спецфункции
  
  if (urla.pathname == "/")
  {
    var pat = "*";
    res.writeHead(200, { 'Content-Type': 'text/plain'} );
    
    //fs.readdir(config.dir, function(err, list) {
    
    var options = { cwd: config.dir };
    glob("**/*", options, function (er, list) {
      res.write(list.join("\n"));
      res.end();
    } );

    return;
  }

  //if (urla.pathname == "/push")

  // кстати из идей пуша могла бы выгружать данные (стирая у себя)
  // и обслуживать редиректы.
  if (urla.query.push)
  {
    var t = urla.query.push;
    var msg = "scheduled to push "+urla.pathname+" to t="+t;

    try {
      var f = config.dir + urla.pathname;

      let stat = fs.statSync(f)
      res.writeHead(200, { 'Content-Type': 'text/plain', 
                           'Content-Length': stat.size.toString()} );
      
      let stream = fs.createReadStream(f)

      let url = t
      fetch(url, {
        method: 'POST',
        body: stream,
      })
      .then((response) => response.text())            
      .then((data) => {
        let tgturl = path.join( url, data )
        console.log(tgturl)
        res.end(tgturl) // итак напечатаем урль целевой
      })
      .catch( err => {
        res.writeHead(500, { 'Content-Type': 'text/plain'} );          
        res.end( err.message )
        console.error( 'catched',err )  
      })
      ;
    } catch( err ) {
      res.writeHead(500, { 'Content-Type': 'text/plain'} );          
      res.end( err.message )
      console.error( err )
    }


/*  res.writeHead(200, { 'Content-Type': 'text/plain'} );
    //todo вернуть урль
    res.end(msg);    

    console.log(msg);
    
    var f = config.dir + urla.pathname;
    fs.createReadStream(f).pipe( request.post(t) );
*/    
    return;
  }

  /// раздача

  // cors и прочее нужное
  let request = req, response = res
    if (request.headers.origin) {
        //const u =  url.parse ( request.headers.referer );
        response.setHeader( "Access-Control-Allow-Origin",request.headers.origin ); // F-REQESTER-CORS
        response.setHeader( "Access-Control-Allow-Headers","Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, If-Modified-Since, ETag" );
        response.setHeader( "Access-Control-Allow-Methods","GET,HEAD,OPTIONS,POST,PUT" );
        response.setHeader( "Access-Control-Allow-Private-Network","true")
    }

  let filePath = path.join( config.dir, (parseInt(urla.pathname.slice(1))).toString() )
  //console.log("r1",urla.pathname,parseInt(urla.pathname.slice(1)),(parseInt(urla.pathname)).toString(),filePath)
  try {
    if (!fs.existsSync(filePath))
        throw `File not exist: ${filePath}`

    var readStream = fs.createReadStream(filePath);

    let stat = fs.statSync(filePath); // причина - nodejs fetch глючит если не давать content-length
    res.writeHead(200, {
        'Content-Type': urla.query.ct || 'application/binary', // не знаю норм или другое надо
        'Content-Length': stat.size
    });
    // https://github.com/nodejs/node/issues/45497
    // https://github.com/nodejs/undici/issues/1414

    // We replaced all the event handlers with a simple call to readStream.pipe()
    let streaming_key = `stream-out: ${urla.pathname}-${process.env.PPK_PUBLIC_ADDR}->${req.socket.remoteAddress} (${stat.size} bytes)`
    console.time(streaming_key)
    readStream.pipe(res);
    console.log("pusha: streaming out",urla.pathname,filePath,"bytes:",stat.size,"to",request.socket.remoteAddress)

    /*
    readStream.on('end',() => {
      console.timeEnd(streaming_key)
    })
    */
    // по идее более правильно вот так
    res.on('finish',() => {
        console.timeEnd(streaming_key)
    })

  } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain'} );
      res.end( err.message )
      console.error( err )
  }
  /*

  // your custom error-handling logic:
  function error(err) {
    res.statusCode = err.status || 500;
    res.end(err.message);
  }

  // your custom headers
  function headers(res, path, stat) {
    // serve all files for download
    // res.setHeader('Content-Disposition', 'attachment');

    // http://127.0.0.1:3333/0?ct=text/plain
    // F-NEED-CONTENT-TYPE
    if (urla.query.ct) {
      console.log('sending content-type',urla.query.ct )
        res.setHeader('Content-Type', urla.query.ct );
      }
  }

  // your custom directory handling logic:
  function redirect() {
    res.statusCode = 301;
    res.setHeader('Location', req.url + '/');
    res.end('Redirecting to ' + req.url + '/');
  }

  function fin() {
    console.log("sent");
  }
  
  // transfer arbitrary files from within
  // /www/example.com/public/*
  
  console.log( urla.pathname );
 
  // todo заменить на фетч
  send(req, urla.pathname, {root: config.dir})
  .on('error', error)
  .on('directory', redirect)
  .on('headers', headers)
  .on('end', fin)
  .pipe(res);
  */
})

// почему-то в опциях не работает..
app.keepAliveTimeout = 60*1000

app.on('error',(err) => {
  console.log('pusha app error',err)
})

app.on('listening',() => {
  console.log("pusha started on",config.port);
})

console.log('staring pusha')
app.listen(config.port);