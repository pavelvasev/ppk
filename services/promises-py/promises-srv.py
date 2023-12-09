#!/bin/env python3.9
# PYTHONUNBUFFERED=TRUE

# todo resources info, cleanup...

import asyncio
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

#from numba import njit, set_num_threads
#set_num_threads(2)

# https://stackoverflow.com/a/37429875
from contextlib import contextmanager
import logging
@contextmanager
def log_time(prefix=""):
    '''log the time usage in a code block
    prefix: the prefix text to show
    '''
    start = time.perf_counter_ns()
    log(prefix,"started")
    try:
        yield
    finally:
        end = time.perf_counter_ns()
        log(prefix, (end - start)/1000000.0,"ms")
        #log(prefix, (end - start)/1000.0,"microseconds")
        #elapsed_seconds = float("%.6f" % (end - start))
        #print(prefix, elapsed_seconds,"sec",flush=True)

start_time = time.perf_counter_ns()
def log(*args):
  cur_tm_millisecs = (time.perf_counter_ns() - start_time)/1000000.0
  print(cur_tm_millisecs,":", *args, flush=True)

class PromisesEnv:  

  def __init__(self, rapi):
    self.rapi = rapi 
    self.promises = {}

  def find_or_create_promise(self, id):
    if id is None:
      print("find_or_create_promise: id is none!")
      return None

    if id in self.promises:
      #print("FOUND EXISTING PROMISE FOR",id,self.promises[id])
      return self.promises[id]

    #print("NEW LOCAL PROMISE",id)  
    p = asyncio.Future()
    self.promises[id] = p
    return p

  async def main(self):
    #print("main start")
    # idea напрашиваются декораторы
    def on_resolve_promise(msg):      
      #await self.on_resolve_promise( msg )
      asyncio.create_task( self.on_resolve_promise( msg ) )

    def on_wait_promise(msg):
      #await self.on_wait_promise( msg )
      asyncio.create_task( self.on_wait_promise( msg ) )

    def on_when_all(msg):
      #print("SEE WHEN ALL")
      #await self.on_when_all( msg )
      asyncio.create_task( self.on_when_all( msg ) )

    def on_when_any(msg):
      #await self.on_when_any( msg )
      asyncio.create_task( self.on_when_any( msg ) )
    
    # но кстати формально сигналом о готовности может быть размещение запроса
    # и мы вполне его могли бы и ловить
    await self.rapi.query( "resolve-promise", on_resolve_promise )
    await self.rapi.query( "wait-promise", on_wait_promise )
    await self.rapi.query( "when-all", on_when_all )
    await self.rapi.query( "when-any", on_when_any )
    #print("main complete")

  async def on_resolve_promise(self,msg):
    pid = msg["promise"]["id"]
    p = self.find_or_create_promise( pid )
    if p is None:
      await self.rapi.reply( msg, { "error": True, "id": pid, "msg": "cannot find or create promise with this id" })
      return
    if p.done():
      await self.rapi.reply( msg, { "error": True, "id": pid, "msg": "promise with this id already resolved" })
      return

    if "payload_info" in msg:
      p.set_result( {"payload_info": msg["payload_info"]} )
    else:
      #print("OK SETTING RESULT TO",p)
      p.set_result( msg["value"] )

    await self.rapi.reply( msg, {"id": pid} )

  async def on_wait_promise(self,msg):
    pid = msg["promise"]["id"]
    p = self.find_or_create_promise( pid )
    if p is None:
      await self.rapi.reply( msg, { "error": True, "id": pid, "msg": "cannot find or create promise with this id" })
      return
    #print("OONWAIT - gonna wait p",p)  
    await p # ждем
    r = p.result()
    await self.rapi.reply( msg, r )

  async def on_when_all(self,msg):
    pid = msg["promise"]["id"]
    p = self.find_or_create_promise( pid )
    if p is None:
      await self.rapi.reply( msg, { "error": True, "id": pid, "msg": "cannot find or create promise with this id" })
      return

    promises = []  
    for lpr in msg["list"]:
      lpid = lpr["id"]
      lp = self.find_or_create_promise( lpid )
      if lp is None:
        await self.rapi.reply( msg, { "error": True, "id": lpid, "msg": "cannot find or create promise with this id" })
        return
      promises.append( lp )

    #print("when-all gonna wait",promises)

    await self.rapi.reply( msg, True )
    await asyncio.wait( promises, return_when=asyncio.ALL_COMPLETED )

    result = list( map( lambda x: x.result(), promises ) )
    #print("When-all waited ok! setting res",result)
    p.set_result( result )


  async def on_when_any(self,msg):
    pid = msg["promise"]["id"]
    p = self.find_or_create_promise( pid )
    if p is None:
      await self.rapi.reply( msg, { "error": True, "id": pid, "msg": "cannot find or create promise with this id" })
      return

    promises = []  
    for lpr in msg["list"]:
      lpid = lpr["id"]
      lp = self.find_or_create_promise( pid )
      if lp is None:
        await self.rapi.reply( msg, { "error": True, "id": lpid, "msg": "cannot find or create promise with this id" })
        return
      promises.append( lp )

    await self.rapi.reply( msg, True )
    done, pending = await asyncio.wait( promises, return_when=asyncio.FIRST_COMPLETED )
    p.set_result( done[0].result() )


async def main(rapi):
  t1 = await rapi.connect( url=urla )
  log("connected to ppk")

  pe = PromisesEnv(rapi)
  await pe.main()

#urla = sys.argv[1]
urla = "ws://127.0.0.1:10000"
log("promises-srv-py: started with url=",urla)

rapi = Client( sender="promises-srv-py" )
#rapi.verbose=True  

loop = asyncio.get_event_loop()
loop.run_until_complete( main(rapi) )
loop.run_until_complete( rapi.t1 )
loop.close()