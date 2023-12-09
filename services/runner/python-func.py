#!/bin/env python3.9
# PYTHONUNBUFFERED=TRUE

import asyncio
from ppk import Client
import numpy as np
import sys
#import marshal
import traceback
#import inspect
#import cloudpickle
import pickle
#import time

urla = sys.argv[1]
interrunner = sys.argv[2]
print("python-func: started with url2=",urla," and interrunner channel=",interrunner,flush=True)
c = Client( sender="python-func" )
#c.verbose = True

#func = lambda x: -1
func_info = { "func": None, "info": "?"}

async def main():
  t1 = await c.connect( url=urla )
  print("python-func:connected",t1,flush=True)
  
  my_task_queue = "python-func-tq-" + c.mkguid()
  
  async def on_getcode(args):
    #print("on-get-code",args)
    b= bytearray.fromhex( args["hex"] )
    
    #func.__code__ = marshal.loads( b )
    func = pickle.loads( b )
    #print("loaded func=",func)
    func_info["func"] = func
    func_info["info"] = args["info"] 

    #print("thus function prepared func=",func,flush=True)
    #print("reporting my task-queue label",flush=True)
    await c.request( {"label":interrunner,"stage":"set_task_queue","python_task_id":my_task_queue}, lambda x: True )

  await c.request( {"label":interrunner,"stage":"getcode"}, on_getcode)

  async def on_compute_request(msg):
    print("python-func: on_compute_request, args=",msg["args"],flush=True)
    #print("gonna call func=",func,flush=True)
    try:
        args = msg["args"]
        
        func = func_info["func"]
        result = await func( **args, rapi=c)
        packet = { "success":True, "value":result }
    except Exception as ex:
        tr = traceback.format_exc()
        packet = { "success":False, "msg":str(ex) + " // " + func_info["info"] + " // " + tr }
    print("computed result. sending repl packet",packet,flush=True)
    # надо предпринять меры, если вернули двоичные данные
    await c.reply( msg, packet )
    #print("it is sent",flush=True)

  await c.query( my_task_queue, on_compute_request )

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.run_until_complete( c.t1 )
loop.close()

#asyncio.run( main() )