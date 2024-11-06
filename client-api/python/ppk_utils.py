import os
import asyncio
import ppk
import time
import io
import traceback
process_id_counter = 0

###################
import psutil
import socket

## возвращает список ip-адресов
# сильно экспериментальная штука.
# если что можно вернуться в исходное возвращая ["127.0.0.1"]
def get_ip_addresses():
    ip_addresses = []
    # Получаем все сетевые интерфейсы и их информацию
    for interface, addrs in psutil.net_if_addrs().items():
        print(interface)
        for addr in addrs:
            # Отбираем только IPv4-адреса
            if addr.family == socket.AF_INET:
                if interface == "lo" or interface.startswith("docker"):
                  ip_addresses.append(addr.address)
                else:
                  ip_addresses.insert(0,addr.address)
    return ip_addresses
###################

# todo а зачем у нас каналы у процессов глобальные?
# мы же уже знаем что глобальность вторична вроде как
class StartProcess():
    # idea: prefix
    def __init__( self, rapi ):
        global process_id_counter
        process_id_counter = process_id_counter + 1
        id = f"local_process_{process_id_counter}"        
        #self.input = self.open_channel("input")
        self.stdout = rapi.channel(f"proc_{process_id_counter}_stdout")
        self.stderr = rapi.channel(f"proc_{process_id_counter}_stderr")
        self.finish = ppk.local.as_cell( rapi.channel(f"proc_{process_id_counter}_finish") )
        # todo stdin, terminate / kill 

    async def init(self, cmd, args=[], env_vars={}, opts={}):

        #bufsize = io.DEFAULT_BUFFER_SIZE # почему то не зашло : 64*1024

        async def wait_exit(proc):
            await proc.wait()
            await asyncio.sleep(0.002) 
            # надо ждать ибо изза слипа _handle_stdout получается что после нашего сигнала завершения приходят еще сообщения
            await self.finish.submit( proc.returncode )

        async def _handle_stdout(stdout: asyncio.streams.StreamReader,channel):
            #global bufsize
            #f = None
            #if logfile is not None:
            #    f = await aiofiles.open(logfile, mode=logmode)
            while True:
                try:
                  data = await stdout.readuntil()
                except asyncio.IncompleteReadError as e:  
                    await asyncio.sleep(0.001) # а почему так?
                    break
                except asyncio.LimitOverrunError as e:
                    # https://github.com/ipython/ipython/issues/14005#issuecomment-1509279508
                    #print("HEHE! ")                    
                    k =  io.DEFAULT_BUFFER_SIZE
                    #k = bufsize
                    #print("read upto limit",k)
                    data = await stdout.read(k)
                    #print("got data len",len(data))
                    #data = data + ""
                    # т.е. хоть кусочек прочитаем да и все
                    # мы ибо не обещаем прямо строки шпарить.. это скорее просто местное удобство (зачем-то..)
                    # так что разрубили а там прочитаемы

                line = data.decode('utf-8', errors="replace")
                await channel.submit( line )

        try:
            #cmd = 'trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT;' + cmd
            #if env is not None:
            #    print("env=",env)
            #    xtra_args["env"] = os.environ.copy() | env
            #print("spawning: cmd=",cmd,"args=",args,"other_opts=",other_opts)
            # https://docs.python.org/3/library/subprocess.html#subprocess.Popen
            opts["env"] = os.environ.copy() | env_vars
            proc = await asyncio.create_subprocess_exec(cmd,*args,**opts,
                      stdin=asyncio.subprocess.DEVNULL,
                      stderr=asyncio.subprocess.PIPE,
                      stdout=asyncio.subprocess.PIPE,
                      #bufsize=bufsize,
                      start_new_session=True)
            tasks = []
            tasks.append( asyncio.create_task(_handle_stdout(proc.stdout,self.stdout)) )
            tasks.append( asyncio.create_task(_handle_stdout(proc.stderr,self.stderr)) )
            tasks.append( asyncio.create_task( wait_exit(proc)) )
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
        self.proc = proc

        return self


class PrefixCh():
    def __init__( self, prefix):        
        self.input = ppk.local.Channel()
        self.output = ppk.local.Channel()
        def onmsg(msg):
            self.output.put( prefix + msg )
        self.input.react(onmsg)

class FileWriterCh():
    def __init__( self, filename):
        self.f = open(filename, "w")
        self.input = ppk.local.Channel()
        # канал для вызова close
        # но формально это второй интерфейс. эксперимент что удобнее
        self.stop = ppk.local.Channel()

        def write(msg):
            if not self.f.closed:
                self.f.write(msg)

        self.input.react( write )
        self.stop.react( self.close )

    def close(self,msg=None):
        self.f.close()

### локальная версия
class StartProcessCh():
    # idea: prefix
    def __init__( self):
        #self.input = self.open_channel("input")
        self.stdout = ppk.local.Channel()
        self.stderr = ppk.local.Channel()
        self.finish = ppk.local.as_cell( ppk.local.Channel() )
        # todo stdin, terminate / kill 

    async def init(self, cmd, args=[], env_vars={}, opts={}):

        #bufsize = io.DEFAULT_BUFFER_SIZE # почему то не зашло : 64*1024

        async def wait_exit(proc):
            await proc.wait()
            await asyncio.sleep(0.002) 
            # надо ждать ибо изза слипа _handle_stdout получается что после нашего сигнала завершения приходят еще сообщения
            self.finish.put( proc.returncode )

        async def _handle_stdout(stdout: asyncio.streams.StreamReader,channel):
            #global bufsize
            #f = None
            #if logfile is not None:
            #    f = await aiofiles.open(logfile, mode=logmode)
            while True:
                try:
                  # до конца строки читает
                  data = await stdout.readuntil()
                except asyncio.IncompleteReadError as e:  
                    await asyncio.sleep(0.001) # а почему так?
                    break
                except asyncio.LimitOverrunError as e:
                    # https://github.com/ipython/ipython/issues/14005#issuecomment-1509279508
                    #print("HEHE! ")                    
                    k =  io.DEFAULT_BUFFER_SIZE
                    #k = bufsize
                    #print("read upto limit",k)
                    data = await stdout.read(k)
                    #print("got data len",len(data))
                    #data = data + ""
                    # т.е. хоть кусочек прочитаем да и все
                    # мы ибо не обещаем прямо строки шпарить.. это скорее просто местное удобство (зачем-то..)
                    # так что разрубили а там прочитаемы

                line = data.decode('utf-8', errors="replace")
                channel.put( line )

        try:
            #cmd = 'trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT;' + cmd
            #if env is not None:
            #    print("env=",env)
            #    xtra_args["env"] = os.environ.copy() | env
            #print("spawning: cmd=",cmd,"args=",args,"other_opts=",other_opts)
            # https://docs.python.org/3/library/subprocess.html#subprocess.Popen
            opts["env"] = os.environ.copy() | env_vars
            proc = await asyncio.create_subprocess_exec(cmd,*args,**opts,
                      stdin=asyncio.subprocess.DEVNULL,
                      stderr=asyncio.subprocess.PIPE,
                      stdout=asyncio.subprocess.PIPE,
                      #bufsize=bufsize,
                      start_new_session=True)
            tasks = []
            tasks.append( asyncio.create_task(_handle_stdout(proc.stdout,self.stdout)) )
            tasks.append( asyncio.create_task(_handle_stdout(proc.stderr,self.stderr)) )
            tasks.append( asyncio.create_task( wait_exit(proc)) )
            # эти задачи сами завершатся когда процесс завершится.. хм.    
            #print("start_process: proc started. cmd=",cmd,args,other_opts,"proc=",proc)
        except Exception as ex:
            print("start_process: error! cmd=",cmd,"error=",str(ex))
            print(traceback.format_exc())
            #await self.set_status("Aborted", 0, str(exc))

        async def wait_io():
            for t in tasks:
                await t

        proc.wait_io = wait_io
        self.proc = proc

        return self        