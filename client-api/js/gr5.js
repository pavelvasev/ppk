// скрипт запуска GR5 из ППК программ
// сделан внешним по отношению к папке gr5 т.к. там свой package.json

import * as path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import * as cp from 'node:child_process'
import * as fs from 'node:fs'; // https://nodejs.org/api/fs.html

/*
  идеи
  - как-то бы не печатать логи но похоже --silent отрубает и инфо о порту.

  сделано
  - ключ для авто-открытия браузера. почему бы и нет. 
*/

export function start( open_browser=false ) {  
    let cwd = path.resolve( __dirname, "gr5/dist" )
    let args = [`http-server`] //,"--silent"] 
    // --silent = не печатать логи 
    if (open_browser) args.push("-o")
  	let prg = cp.spawn( `npx`, args,{cwd,stdio: ['ignore','inherit','ignore']} )
    // detached:true, если делать детачед то он остается висеть по завершению программы.
  	return prg
}