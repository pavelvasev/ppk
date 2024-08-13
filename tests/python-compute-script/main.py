#!/bin/env python3.9

import asyncio
import ppk
import ppk_main
import os
import time
import sys
import atexit
import subprocess

rapi = ppk.Client()
s = ppk_main.EmbeddedServer()
# s = ppk.RemoteSlurm()
# sw = ppk.LocalServer()

def on_worker_msg(msg):
    print("msg from worker: ",msg)

async def start_worker_process(url, worker_id, input_channel_id, output_channel_id,logdir):
    env = os.environ.copy() | {"PPK_INPUT_CHANNEL":input_channel_id,"PPK_OUTPUT_CHANNEL":output_channel_id,"PPK_URL":url}
    log = os.open(f"{logdir}/{worker_id}.log",os.O_WRONLY | os.O_CREAT,0o644)
    logerr = os.open(f"{logdir}/{worker_id}.err.log",os.O_WRONLY | os.O_CREAT,0o644)

    # subprocess.popen уместнее было бы
    p = await asyncio.create_subprocess_exec(sys.executable,"worker.py",env=env,stdin=subprocess.DEVNULL,stderr=logerr,stdout=log)
    def cleanup():
        if p.returncode is None:
            p.terminate()
    atexit.register(cleanup)
    return p

async def main():
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

    worker_channels = []
    os.mkdir("log",0o755)
    for x in range(0,4):
        ch = rapi.channel( f"wrk_{x}" )
        worker_channels.append(ch)
        await start_worker_process( s_urls[0], f"wrk_{x}", ch.id, workers_output_channel.id,"log" )

    await asyncio.sleep( 1 )
    print("workers: started..")

    for w in worker_channels:
        w.put( [10,20,42] )
    
    await asyncio.sleep( 1*100000 )
    print("Exiting")
    await c.exit()
    await s.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
# loop.run_until_complete( c.t1 )
loop.close()
