import * as path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import * as cp from 'node:child_process'

import * as fs from 'node:fs'; // https://nodejs.org/api/fs.html

/* нижеследующее выглядит ортогональным вполне.
   ибо можно и находясь на кластере, запустить в указанном месте (или на хосте)
   центральный сервис, а затем обычными slurm-командами запускать воркеров..
   с этим надо подразобраться. но и пока так для осмысления норм ))   
*/

const LOGDIR = "./log"; // todo сделать получше + рассинхрон с sh-скриптами (там тоже логдир)
let dir = LOGDIR;
if (!fs.existsSync(dir)){
	fs.mkdirSync(dir);
}

/////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////

export class Starter {
  constructor( ) 
  {

  	this.started_prgs = []

  	// https://blog.heroku.com/best-practices-nodejs-errors
  	process.on('uncaughtException', err => {
  		//console.log("Slurm: see process exception")
  		console.log("Local: uncaughtException")
  		console.error( err )
  		this.stop()
		})

		process.on('exit', err => {
			console.log("Local: exit")
  		this.stop()
		})
		process.on('SIGINT', err => {
			console.log("Local: SIGINT")			
  		this.stop()
  		process.exit()
		})
		/*
		process.on('exit', err => {
			console.log("Local: exit")
  		this.stop()
		})
		process.on('exit', err => {
			console.log("Local: exit")
  		this.stop()
		})						
		*/
  }

  stop( prg ) {

  	if (!prg) {
  		while (this.started_prgs.length > 0) {
  			let p = this.started_prgs.pop()
	  		this.stop( p )
  		}
  		return
    }    
    console.log("Local:stopping process",prg.pid)
  	prg.kill()
  }

  start_workers( count, workers=1, memory=1000, have_gpu=true, slurm_opts='', verbose ) {
    let proms = []
    for (let i=0; i<count; i++)
    	  proms.push( this.start_workers_1( 1,workers,memory,have_gpu, slurm_opts, verbose))
    return Promise.allSettled( proms )
  }
  /*
    что-то не могу разобраться с видеокартами.. --gres и т.п. .. надо с нашими советоваться
    поэтому вместо -n число
    делаем -n 1 зато число раз
    ну и плюс у текущего подхода - это то что можно по частям запускать..
    т.е. скажем запросим 20 оно даст 5.. ну и ладно..
		ну а так.. это надо в runner-менеджер я думаю перевести будет запросы все эти.
  */

  /*
    count - сколько job-ов запустить
    workers - сколько worker-ов в одной job-е
    memory - сколько памяти на job-у
    have_gpu - затребовать для job-ы gpu (одна штука, будет распределена на всех воркеров)
	  slurm_opts - доп. параметры для слурм, например раздел указать
  */
  job_spawn_counter = 0
  start_workers_1( count, workers, memory, have_gpu, slurm_opts='', verbose )
  {
  	let prgpath = path.resolve( __dirname, "../../features/local/ppk-job.sh" )

  	/* замысел построен на идее dask что пользователь запускает Н job-ов
  	   указывая параметры каждой job-ы
  	*/

  	// ssh -t -t u1321@umt.imm.uran.ru "cd /home/u1321/_scratch2/ppk/k2/features/slurm; srun -p v100 -n 100 
  	// -t 40 --gres=gpu:v100:1 --mem-per-cpu=16000 --cpus-per-task=4 
  	// --export="ALL,NWORKERS=4,MEM_LIMIT=16000,MOZG_URL=ws://172.16.33.3:10000" ./ppk-job.sh"

  	// плохо, потому что сколько будет кушать пуша даже неизвестно..
  	// равно как неизвестно а запустится ли пуша вовсе..
  	// ну на худой конец дадим существенную вещь, типа увеличим лимит на 1 гб для всего - т.е. это будет и для воркеров и для пуши
  	// ладно с пушей надо отдельно будет разбираться. особенно с учетом что ей вроде как общую память собрались отдавать
  	// а это надо с нидами согласовывать.. чтобы они не подъедали..

		let per_worker_mem = memory / workers

		let args = []
		let job_id = `j${this.job_spawn_counter++}`
		let env = { NWORKERS: workers, RAM_LIMIT: per_worker_mem, JOB_ID: job_id }
		if (verbose) env['VERBOSE'] = 1

  	//let prgpath = `ssh -t -t -L 8000:localhost:8000 -L 12000:localhost:12000 -L 3333:localhost:3333 ${this.ssh_endpoint} "cd ${this.ppk_path}; ./all-main-services.sh"`
  	//let prgpath = path.resolve( __dirname, "../bin-umt/!all-services-with-tunnel.sh" )
  	//console.log('Slurm: spawning job request',prgpath,args)
  	let prg = cp.spawn( prgpath, args,{env: {...process.env,...env},detached:true,stdio: ['ignore','pipe','pipe']} )  	
  	this.started_prgs.push( prg )

  	var logStream = fs.createWriteStream(path.join(LOGDIR,"start-workers.log"), {flags: 'a'} );
	  prg.stdout.pipe( logStream )

  	let resolved=false
		return new Promise( (resolve,reject) => {
	    prg.on('spawn', (data) => {
	        //console.log(`Slurm: >>>>> job-request [${prg.pid}] `,"spawned!")
	    });
	    prg.stderr.on('data', (data) => {
	      let s = data.toString('utf8')
	      if (verbose)
	          console.log('LocalWorkers: stderr from job-request >>> ',s)
	    })
	    prg.stdout.on('data', (data) => {
	      let s = data.toString('utf8')
	      //console.log('Slurm: data from job-request >>> ',s)
	      if (!resolved) {
	        if (s.indexOf('job-started') >= 0) {
	          resolved = true

	          prg.unref(); // мы не ждем пока она завершится. если этого не сделать то наша программа не закончится,
	          // будет ждать завершения подпроцесса
	          prg.stdout.unref()
	          prg.stderr.unref()

	          let res = "job-started"
	          if (verbose)
	              console.log("LocalWorkers: job-started",args)

            resolve(res)
	        }
	      }
	      if (s.indexOf('error') >= 0) {
	      	console.log('LocalWorkers error: ',s,"for request:",args)
	      	reject( s )
	      }
	    })
	    prg.on('error', (data) => {
	      console.log(`LocalWorkers: job-request error [${prg.pid}] `,"error:",data)
	    });
	 })  	

  }

  // на самом деле это не start а start_main - т.е запускаем голову на хосте умт..
  // зачем непонятно. но предположим. хотя формально могли бы обойтись проксями
  // а остальное тут держать. но впрочем там же и менеджера запустить.
  start(ppk_wait_runners='') {
  	let prgpath = path.resolve( __dirname, "../../all-main-services.sh" )

  	let args = []
  	console.log('Local: spawning main',prgpath)

    // PPK_WAIT_RUNNERS=${ppk_wait_runners} todo
  	let prg = cp.spawn( `${prgpath}`, args,{detached:true,stdio: ['ignore','pipe','pipe']} )
	  let resolved=false
	  this.prg = prg
	  this.started_prgs.push( prg )

	  var logStream = fs.createWriteStream(path.join(LOGDIR,'/main.log'), {flags: 'w'});
	  prg.stdout.pipe( logStream )

	  return new Promise( (resolve,reject) => {
	    prg.on('spawn', (data) => {
	        console.log(`Local: >>>>> subprocess for main [${prg.pid}] `,"spawned!")
	    });
	    prg.stderr.on('data', (data) => {
	      let s = data.toString('utf8')
	      console.log('Local: stderr from main >>> ',s)
	    })
	    prg.stdout.on('data', (data) => {
	      let s = data.toString('utf8')
	      //console.log('Slurm: data from main >>> ',s)
	      if (!resolved) {
	        if (s.indexOf('all-started') >= 0) {
	          resolved = true
	          this.url = "ws://127.0.0.1:10000"
	          this.submit_payload_url = "http://127.0.0.1:3333"

	          prg.unref(); // мы не ждем пока она завершится
	          prg.stdout.unref()
	          prg.stderr.unref()

	          //console.log("startting timeout")
	          setTimeout( () => {
	            resolve({url:this.url,
	            	  submit_payload_url:this.submit_payload_url
	            	  })
	          },1000)
	        }
	      }
	    })
	    prg.on('error', (data) => {
	      console.log(`Local: main program error [${prg.pid}] `,"error:",data)
	    });
	 })

  }
}