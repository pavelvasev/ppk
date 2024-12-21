#!/bin/env python3.9

import asyncio
import ppk
import os
import time
import sys  
import atexit
import subprocess
import ppk.genesis as gen

# s = ppk.RemoteSlurm()
# sw = ppk.LocalServer()

def on_worker_msg(msg):
    print("msg from worker: ",msg)

async def start_worker_process(url, worker_id, input_channel_id, output_channel_id,logdir):
    env = os.environ.copy() | {"PPK_INPUT_CHANNEL":input_channel_id,"PPK_REPORT_CHANNEL":output_channel_id,"PPK_URL":url}
    log = os.open(f"{logdir}/{worker_id}.log",os.O_WRONLY | os.O_CREAT,0o644)
    logerr = os.open(f"{logdir}/{worker_id}.err.log",os.O_WRONLY | os.O_CREAT,0o644)

    # subprocess.popen уместнее было бы
    p = await asyncio.create_subprocess_exec(sys.executable,"../ppk_genesis_worker.py",env=env,stdin=subprocess.DEVNULL,stderr=logerr,stdout=log)
    def cleanup():        
        if p.returncode is None:
            p.terminate()
    atexit.register(cleanup)
    return p

async def main():
    rapi = ppk.Client()
    s = ppk.main.EmbeddedServer()
    print("starting system")
    s1 = await s.start()
    print("system started, connecting")
    s_urls = s.urls_future.result()
    
    t1 = await rapi.connect( url=s_urls[0] )
    print("connected",t1)

    print("workers: starting..")
    """
    трилема
    - msg,query и 2 направления
    - channel и там put, react и 2 канала
    - но кстати воркеры могут высылать куда угодно нам неважно
    - или request и ответ?

    выбрано channel чтобы затестить наше новое синхронное апи,
    но и там 2 варианта - передавать id всех каналов или только 
    общий префикс (как бы id процесса получается)
    """
    # идея сделать им там input и output
    workers_output_channel = rapi.channel("worker_outputs")
    workers_output_channel.react( on_worker_msg )

    worker_cnt = 0
    worker_wait = asyncio.Future()
    def worker_attached( msg ):
        nonlocal worker_cnt, worker_wait
        worker_cnt = worker_cnt + 1
        if worker_cnt == 4:
            worker_wait.set_result(1)
    workers_output_channel.react( worker_attached )    

    worker_channels = []
    if not os.path.exists("log"):
       os.mkdir("log",0o755)
    for x in range(0,4):
        ch = rapi.channel( f"wrk_{x}" ).cell()
        #ch.put( [11,12,13,14,15] )
        worker_channels.append(ch)
        await start_worker_process( s_urls[0], f"wrk_{x}", ch.id, workers_output_channel.id,"log" )

    
    
    await worker_wait
    print("workers: started..")

    print("action")

    #for w in worker_channels:
    #    w.put( [10,20,42] )

    #####
    #nodes = gen.node( "print", text="privet",links_in={"input":["a1"]} )
    #worker_channels[0].put( {"description":nodes})
    nodes = gen.node( "print", text="privet",links_in={"input":["a1"]} )
    worker_channels[0].put( {"description":nodes})
    nodes = gen.node( "timer", links_out={"output":["a1"]} )
    worker_channels[1].put( {"description":nodes})

    # todo надо бы получить ответ (request)
    await asyncio.sleep( 1 )

    #a1 = rapi.channel("a1")
    #a1.put(333)

    print("done, waiting forever")
    await asyncio.sleep( 1*100000 )
 
    print("Exiting")
    await c.exit()
    await s.exit()

#loop = asyncio.get_event_loop()
#loop.run_until_complete( main() )
#loop.close()
try:
  asyncio.run( main(),debug=True )
finally:
  sys.exit()

