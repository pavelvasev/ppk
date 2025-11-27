#!/bin/env python3

import asyncio
import ppk
import os,sys
import atexit

async def start_worker_process( rapi, cmd_and_args, worker_id ):
    env = os.environ.copy()
    env["SERVER_URL"] = rapi.server_url
    proc = await asyncio.create_subprocess_exec(*cmd_and_args,env=env,stdin=asyncio.subprocess.DEVNULL,start_new_session=True)

    def make_cleanup_fn( proc, worker_id):
        def cleanup():            
            if proc.returncode is None:
                print("sending terminate to worker_id=",worker_id)
                proc.terminate()
        return cleanup

    #atexit.register( make_cleanup_fn(proc,worker_id) )
    # this may be better
    rapi.atexit( make_cleanup_fn(proc,worker_id) )


async def main(rapi):
    print("============== server started. url=",rapi.server_url)

    print("starting subprocesses")
    for i in range(2):
        worker_id = f"wrk_{i}"
        cmd_and_args = [sys.executable, "worker.py",worker_id]
        await start_worker_process( rapi, cmd_and_args, worker_id )

    def callback(msg):
        print("callback called! msg=",msg)

    print("=========== installing query to topic `test2`")
    await rapi.query( "test2",callback )

    s = 0
    while True:
        await asyncio.sleep(5)
        print("=========== app1: sending messages to topic `test1`")
        await rapi.msg( {"label":"test1","start":s} )
        s = s + 100 

    print("============ done")  

ppk.start( main )

