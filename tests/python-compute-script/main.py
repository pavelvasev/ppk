#!/bin/env python3.9

import asyncio
import ppk
import ppk_main
import os
import time
import sys
import atexit

rapi = ppk.Client()
s = ppk_main.EmbeddedServer()
# s = ppk.RemoteSlurm()
# sw = ppk.LocalServer()

def f(msg):
    print("f action ! msg=",msg)

def on_worker_msg(msg):
    print("msg from worker: ",msg)

async def start_worker_process(url, channel_id):
    env = os.environ.copy() | {"PPK_WRK_CHANNEL":channel_id,"PPK_URL":url}
    p = await asyncio.create_subprocess_exec(sys.executable,"worker.py",env=env)
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
    """
    # идея сделать им там input и output
    worker_channels = []
    for x in range(0,4):
        c = f"wrk_{x}"
        await start_worker_process( s_urls[0], c)
        ch = ppk.Channel( self.rapi,c )
        #rapi.channel( c + ":input" )
        #rapi.channel( c + ":output" )
        worker_channels.append(c)
    print("workers: started..")

    for x in worker_channels:
        x[0].put("hello")
        x[1].react(on_worker_msg)
    
    # await rapi.reaction( "test", rapi.python( f ))
    print("installed query")
    await rapi.query( "test",qcb )    
    await rapi.link("test42","test")
    
    await asyncio.sleep( 1*100000 )
    print("Exiting")
    await c.exit()
    await s.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
# loop.run_until_complete( c.t1 )
loop.close()
