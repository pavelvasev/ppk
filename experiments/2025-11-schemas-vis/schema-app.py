#!/bin/env python3

import asyncio
import traceback
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
    p = await asyncio.create_subprocess_exec(sys.executable,"./genesis_worker.py",env=env,stdin=subprocess.DEVNULL,stderr=logerr,stdout=log)
    def cleanup():        
        if p.returncode is None:
            p.terminate()
    atexit.register(cleanup)
    return p


# todo
#class WorkerStater:
#  def __init__(self):

# возвращает пачку объектов каналов для передачи сообщений воркерам
# todo refactor to run single .sh
async def start_workers( rapi, request_prefix, task_count, cpu_per_task_count ):
    workers_output_channel = rapi.channel("worker_outputs")
    workers_output_channel.react( on_worker_msg )

    worker_cnt = 0
    total_cnt = task_count * cpu_per_task_count
    worker_wait = asyncio.Future()
    def worker_attached( msg ):
        nonlocal worker_cnt, worker_wait
        worker_cnt = worker_cnt + 1
        if worker_cnt == total_cnt:
            worker_wait.set_result(1)
    workers_output_channel.react( worker_attached )

    worker_channels = []
    if not os.path.exists("log"):
       os.mkdir("log",0o755)
    for t in range(task_count):
        for x in range(cpu_per_task_count):
            worker_id = f"wrk_{request_prefix}_{t}_{x}"
            ch = rapi.channel( worker_id ) #.cell()
            #ch.put( [11,12,13,14,15] )
            worker_channels.append(ch)
            await start_worker_process( rapi.server_url, worker_id, ch.id, workers_output_channel.id,"log" )

    print("start_workers: waiting workers to start...")
    await worker_wait 
    print("start_workers: workers started")
    return worker_channels

async def main():
    rapi = ppk.Client()
    s = ppk.main.EmbeddedServer()
    print("starting system")
    s1 = await s.start()
    print("system started, connecting")
    s_urls = s.urls_future.result()
    
    t1 = await rapi.connect( url=s_urls[0] )
    print("connected",t1)

    worker_channels = await start_workers( rapi, "A", 1, 4 )

    #####
    #nodes = gen.node( "print", text="privet",links_in={"input":["a1"]} )
    #worker_channels[0].put( {"description":nodes})
    nodes = gen.node( "print", text="privet",links_in={"input":["a1"]} )
    worker_channels[0].put( {"description":nodes})
    nodes = gen.node( "timer", links_out={"output":["a1"]} )
    worker_channels[1].put( {"description":nodes})

    print("done, waiting forever")
    await asyncio.Future()
 
    print("Exiting")
    await c.exit()
    await s.exit()

#loop = asyncio.get_event_loop()
#loop.run_until_complete( main() )
#loop.close()
try:
  asyncio.run( main(),debug=True )
except ValueError as e:
    print(f"Caught an exception in my_coroutine: {e}")  
    traceback.print_exc()
finally:
  sys.exit()