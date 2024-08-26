########################################### стартер

# todo разделить на стартер локального сервера (но он уже не нужен особо)
# и на стартер воркеров (это ценное)

# ps j -A
# kill -SIGTERM -- -1892333

# https://www.programcreek.com/python/example/82526/asyncio.create_subprocess_exec
# https://www.programcreek.com/python/?code=erdewit%2Fdistex%2Fdistex-master%2Fdistex%2Fpool.py
# https://github.com/erdewit/distex

import os
import aiofiles
import atexit 
import traceback
import asyncio
import signal

# subprocess.popen ?    
# проще мб так завершать чем поштучно
#import os
#import signal
#os.setpgrp()   
#os.killpg(0, signal.SIGTERM)

# todo это похоже лишнее. надо просто дать потоки наружу да и все
async def start_process( cmd, args=[], other_opts={}, on_line=None, on_line_err=None ):

    async def _handle_stdout(stdout: asyncio.streams.StreamReader,on_line_out):
        #f = None
        #if logfile is not None:
        #    f = await aiofiles.open(logfile, mode=logmode)
        while True:
            try:
              data = await stdout.readuntil()
            except asyncio.IncompleteReadError as e:  
                await asyncio.sleep(0.001)
                break
            line = data.decode('utf-8')
            await on_line_out( line )

    try:
        #cmd = 'trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT;' + cmd
        xtra_args = {}
        #if env is not None:
        #    print("env=",env)
        #    xtra_args["env"] = os.environ.copy() | env
        #print("spawning: cmd=",cmd,"args=",args,"other_opts=",other_opts)
        proc = await asyncio.create_subprocess_exec(cmd,*args,**other_opts,
                  stdin=asyncio.subprocess.DEVNULL,
                  stderr=(asyncio.subprocess.PIPE if on_line is not None else asyncio.subprocess.DEVNULL),
                  stdout=(asyncio.subprocess.PIPE if on_line_err is not None else asyncio.subprocess.DEVNULL),
                  start_new_session=True)
        tasks = []
        if on_line is not None:
            tasks.append( asyncio.create_task(_handle_stdout(proc.stdout,on_line)) )
        if on_line_err is not None:
            tasks.append( asyncio.create_task(_handle_stdout(proc.stderr,on_line_err)) )
        # эти задачи сами завершатся когда процесс завершится.. хм.    
        #print("start_process: proc started. cmd=",cmd,args,other_opts,"proc=",proc)
    except Exception as ex:
        print("start_process: error",cmd,str(ex))
        print(traceback.format_exc())
        #await self.set_status("Aborted", 0, str(exc))

    async def wait_io():
        for t in tasks:
            await t

    proc.wait_io = wait_io
    return proc


# запускает систему
# todo - останавливать процессы по завершению текущего процесса
#      


# фреймворк для запускателей
# конкретный запускатель должен предоставить методы main_cmd и job_cmd
# которые возвращают команду запуска локального процесса в форме
# [PRG, ARGS, OTHER-OPTS ] для передачи в create_subprocess_exec
class SystemStarter:

    def __init__(self):
        self.worker_tasks = []
        self.processes = []
        self.jobs_counter = 0
        self.url = "ws://127.0.0.1:10000"
        atexit.register(self.cleanup) # это системное..

    # см также https://stackoverflow.com/questions/320232/ensuring-subprocesses-are-dead-on-exiting-python-program
    # но вообще, по идее, надо - закрывать стартер командой exit или close..
    def cleanup(self):
        #print("cleanup: exiting child processes")
        for p in self.processes:
            #print("term child ",p.pid)
            if p.returncode is None:
                p.terminate()
                #await p.wait() # таки подождать пока завершится
            #p.send_signal( signal.SIGTERM )

    # завершение работы всех процессов с ожиданием завершенности
    async def exit( self ):
        self.cleanup()
        for p in self.processes:
            if p.returncode is None:
                await p.wait()
                await p.wait_io() # дождемся потоки
        #print("started awaited all processes")        
        #self.processes = []
        # дадим возможности дописать потоки.. раз уж мы их руками не завершаем
        # await asyncio.sleep( 0.1 )

    async def start( self,ppk_wait_runners=0 ):
        self.log_main = await aiofiles.open("main.log", mode="w")
        self.log_workers = await aiofiles.open("workers.log", mode="w")

        return await self.start_main( ppk_wait_runners )

    def save_process( self,p ):
        self.processes.append( p )

    def forget_process( self,p ):
        self.processes.remove( p )

    async def start_main( self,ppk_wait_runners ):
        prg = os.path.normpath( os.path.join( self.ppk_path, "all-main-services.sh") )
        
        cmd = self.main_cmd(ppk_wait_runners)
        
        f = asyncio.Future()
        url = "ws://127.0.0.1:10000"
        async def on_s( line ):
            if "all-started" in line:
                f.set_result(url)
            if "cannot find runner" in line or "runner_detached" in line:
                print( line.rstrip() )
            await self.log_main.write( line )
            await self.log_main.flush()
        async def on_s2( line ):
            await self.log_main.write( "err: "+line )
            await self.log_main.flush()
        
        p = await start_process( *cmd, on_line=on_s, on_line_err=on_s2)
        self.save_process( p )
        return await f

    async def start_one_job( self,workers, memory, slurm_opts="",counter=0 ):
        cmd = self.job_cmd( workers, memory, slurm_opts, counter )
        #print("start_one_job: cmd=",cmd)
        log_prefix = str(counter) + ": "

        async def on_line(line):
            if line.startswith( "job-started" ):
                print("worker: ",line.rstrip() )
            await self.log_workers.write( log_prefix + line )
            await self.log_workers.flush()

        async def on_line_err(line):
            await self.log_workers.write( log_prefix + "err: "+line )
            await self.log_workers.flush()
        
        #print("worker: passing to start-process")    
        prg = await start_process( *cmd, on_line=on_line, on_line_err=on_line_err )
        #print("worker: process started")
        self.save_process( prg )
        await prg.wait()
        self.forget_process( prg )
        #print("worker: process finished. returncode=",prg.returncode)


    async def start_workers( self,count, workers, memory, slurm_opts="" ):        
        for i in range(count):
            t = asyncio.create_task( self.start_one_job( workers, memory, slurm_opts, self.jobs_counter ) )
            self.jobs_counter = self.jobs_counter + 1
            self.worker_tasks.append(t)
        return

# запускает систему и воркеров на умт
class RemoteSlurm(SystemStarter):
    # cmd - тройка [prg, args, env]
    def prepare_cmd(self,ssh_cmd,xtra=[]):
        #rcmd = "ssh -t -t " + xtra + " " + self.ssh_endpoint + orig-cmd
        #args = ["-t",'-t'] + xtra + [self.ssh_endpoint, ssh_cmd]
        #ssh_cmd = ssh_cmd + " & read ; kill $!"
        #args = xtra + [self.ssh_endpoint, ssh_cmd]
        args = ["-tt"] + xtra + [self.ssh_endpoint, ssh_cmd]
        # stdout=asyncio.subprocess.PIPE
        return ["ssh",args,{}]

    # должна вернуть тройку [prg, args, env]
    def job_cmd( self,workers, memory, slurm_opts="",starter_job_id=None ):
        count=1
        per_worker_mem = round(memory / workers)
        per_job_cpus = workers

        cmd = (("cd %s/features/slurm; srun -n %s --mem-per-cpu=%s --cpus-per-task=%s %s" % (self.ppk_path,count,per_worker_mem,per_job_cpus,slurm_opts)) +
               (" --export=ALL,NWORKERS=%s,RAM_LIMIT=%s,MOZG_URL=ws://%s:10000,PPK_SOCKS_LOCK=socks5://%s:15001 ./ppk-job.sh"  % (workers,per_worker_mem,self.ppk_public_addr,self.ppk_public_addr)))
        
        return self.prepare_cmd(cmd)

    def main_cmd( self, ppk_wait_runners=0 ):
        #prg = os.path.join( self.ppk_path, "all-main-services.sh") 
        """
        return [prg,[],{"PPK_WAIT_RUNNERS":str(ppk_wait_runners),
                        "PPK_PUBLIC_ADDR":self.ppk_public_addr,
                        "PPK_SOCKS_LOCK":("socks://%s:15001" % self.ppk_public_addr)}]
        """
        cmd = "cd %s; PPK_WAIT_RUNNERS=%s PPK_PUBLIC_ADDR=%s PPK_SOCKS_LOCK=socks5://%s:15001 ./all-main-services.sh" % (self.ppk_path,ppk_wait_runners,self.ppk_public_addr,self.ppk_public_addr)

#        xtra = ["-D","15000","-R","15001",
#                                    "-L","10000:localhost:10000","-L","3333:localhost:3333"]
        return self.prepare_cmd(cmd)
        #return cmd

    async def start( self,ppk_wait_runners=0 ):
        # прокси
        # https://unix.stackexchange.com/a/156813
        """
        socks_proxy = await start_process( 
             *self.prepare_cmd( "",["-N","-D","15000","-R","15001",
                                    "-L","10000:localhost:10000","-L","3333:localhost:3333"] ) )
        """                                    
        
        socks_proxy = await start_process( 
             *[ "ssh",["-N","-D","15000","-R","15001",
                                    "-L","10000:localhost:10000","-L","3333:localhost:3333",self.ssh_endpoint] ] )
        self.save_process( socks_proxy )
        #print("socks started")
        await asyncio.sleep( 0.1 ) # чтобы соксы стартовали..

        # настроим теперь себе чтобы наши клиенты шли куда надо..
        os.environ['PPK_SOCKS_LOCK'] = 'socks5://127.0.0.1:15000'
        os.environ['PPK_USER_MACHINE'] ='yep'
        
        return await super().start( ppk_wait_runners)

        #return await self.start_main( ppk_wait_runners )


    def __init__(self,ssh_endpoint="u1321@umt.imm.uran.ru",ppk_path="/home/u1321/_scratch2/ppk/k4/",ppk_public_addr="172.16.33.3"):
        self.ppk_path = ppk_path        
        self.ppk_public_addr = ppk_public_addr
        self.ssh_endpoint = ssh_endpoint
        self.worker_tasks = []
        super().__init__()

# запускает систему и воркеров на текущей машине
class LocalServer(SystemStarter):
    
    # должна вернуть тройку [prg, args, env]
    def job_cmd( self,workers, memory, slurm_opts="",starter_job_id=None ):
        per_worker_mem = round(memory / workers)
        per_job_cpus = workers
        prg = os.path.join( self.ppk_path, "features/local/ppk-job.sh") 
        
        #cmd = "NWORKERS=%s RAM_LIMIT=%s %s" % (workers, per_worker_mem, prg)
        #print("job_cmd=",cmd,"self.ppk_path=",self.ppk_path)
        return [prg, [], {"env":os.environ | {"NWORKERS":str(workers), "RAM_LIMIT":str(per_worker_mem),"JOB_ID":"j"+str(starter_job_id)}}]

    def main_cmd( self, ppk_wait_runners=0 ):
        #cmd = "%s/all-main-services.sh" % (self.ppk_path)
        prg = os.path.join( self.ppk_path, "all-main-services.sh") 
        return [prg,[],{"env": os.environ | {"PPK_WAIT_RUNNERS":str(ppk_wait_runners)}}]

    def __init__(self):
        self.ppk_path = os.path.normpath( os.path.join( os.path.dirname(os.path.realpath(__file__)),"../.." ))
        self.ppk_public_addr = "127.0.0.1"
        self.worker_tasks = []
        super().__init__()