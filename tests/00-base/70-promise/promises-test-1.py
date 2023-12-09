#!/bin/env python3.9
# PYTHONUNBUFFERED=TRUE

# todo resources info, cleanup...

import asyncio
import ppk
from ppk import Client
#import numpy as np
import sys
#import marshal
import traceback
import inspect
#import cloudpickle
#import pickle
#import time
import gc

import time

MEMORY=10000
WORKERS=4


async def main(rapi):
  #s1 = await s.start(0)
  #w1 = await s.start_workers( 1, WORKERS, MEMORY )
  
  t1 = await rapi.connect( url=urla )
  print("connected to ppk")

  p = rapi.create_promise()
  await rapi.resolve_promise(p,42)
  res = await rapi.wait_promise(p)
  f = await res
  print("res=",f)
  #await s1.exit()
  await rapi.exit()

#urla = sys.argv[1]
urla = "ws://127.0.0.1:10000"
print("promises-srv-py: started with url=",urla)

rapi = Client( sender="promises-srv-py" )
rapi.verbose=True
#s = ppk.LocalServer()

loop = asyncio.get_event_loop()
loop.run_until_complete( main(rapi) )
loop.run_until_complete( rapi.t1 )
loop.close()