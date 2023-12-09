#!/bin/env python3.9

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation
#from numba import cuda
import numba

import asyncio
import ppk
import time
import random

c = ppk.Client()

async def main():
    print("connecting")
    t1 = await c.connect()
    print("connected",t1)

    coords = {}

    def setcoords(id,val):
        if id not in coords:
            coords[id] = asyncio.Future()
        p = coords[id]    
        p.set_result( val )
        
    async def getcoords(id):
        if id in coords:
            k = coords[id]
            await k
            return k.result()
        p = asyncio.Future()
        coords[id] = p
        await p
        return p.result()

    async def on_resolve_promise(msg):        
        h = {"X":0,"Y":0,"Z":0,"add_data":True}
        #print("on-resolve-promise",msg)
        p = msg["promise"]
        if "add_data" not in p:
            return
        if "hint" in p:
            h = p["hint"]
        #h["type"]    
        setcoords(p["id"],h)
        await c.msg( {"label":"coords","append":[h]} )

    async def on_when_all(msg):
        
        list = msg["list"]
        pid = msg["promise"]["id"]
        print("see when-all",pid,end="\r")

        async def compute():
            maxx = 0
            for k in list:
                id = k["id"]
                #if id not in coords:
                #    print("data not in coords",id)
                #    continue # add-data там может... или еще не накопили?
                cc = await getcoords(id)
                if cc["X"] > maxx:
                    maxx = cc["X"]
            # было q = {"X":maxx,"Y":-1,"Z":-1,"type":"when-all"}
            # но некрасиво - оси непараллельные визуально.. 
            q = {"X":maxx,"Y":0,"Z":-2,"type":"when-all"}

            print("when-all adding coords",pid,q,end="\r")
            
            setcoords(pid,q)
            await c.msg( {"label":"coords","append":[q]} )

            for k in list:
                id = k["id"]
                async def submit(id,q):
                    prev_coords = await getcoords(id)
                    #print("ok when-all see coords",prev_coords)
                    await c.msg( {"label":"coords","line":[q, prev_coords,"simple"]} )
                asyncio.create_task( submit(id,q) )
        asyncio.create_task( compute() )                        

    async def on_task_assigned(msg):
        task = msg["task"]
        #print("ontask")

        if "hint" in task:
          h = msg["task"]["hint"]

          h["Y"] = msg["runner_index"]
          #h["Y"] = h["Z"]
          #h["Z"] = msg["runner_index"]
        else:
          r = 5
          h = {"X":r*random.random(),"Y":r*random.random(),"Z":random.random()}   
#        print("task assigned",msg["task"]["id"])
        id = task["id"]
        setcoords(id,h)

        await c.msg( {"label":"coords","append":[h]} )

        # теперь посмортим аргументы
        for k,v in task["arg"].items():
            #print("k=",k,"v=",v)
            if isinstance(v,dict) and "code" in v and v["code"] == "reuse-payloads":
                varg = v["arg"]
                prev_task_id = varg["p"]["id"]
                alloc = varg["alloc"]
                type = "alloc" if alloc else "reuse"

                async def submit(type,prev_task_id,h):
                    prev_coords = await getcoords( prev_task_id )
                    #print("ok see transfer of ",type,h,prev_coords)
                    await c.msg( {"label":"coords","line":[h, prev_coords,type]} )
                asyncio.create_task( submit(type,prev_task_id,h) )
                
            if isinstance(v,dict) and "p_promise" in v:
                # обычная передача в стиле restore-object
                prev_task_id = v["id"]
                    #coords[ prev_task_id ] = {"X":0,"Y":0,"Z":0}
                if ("simple" not in v or ("simple" in v and not v["simple"] )):
                    type = "promise"
                else:  
                    type = "simple"
                
                async def submit(type,prev_task_id,h):
                    prev_coords = await getcoords( prev_task_id )
                    #print("ok see transfer of ",type,h,prev_coords)
                    await c.msg( {"label":"coords","line":[h, prev_coords,type]} )
                asyncio.create_task( submit(type,prev_task_id,h) )    

    await c.query("task-assigned",on_task_assigned)
    await c.query("when-all",on_when_all)
    await c.query("resolve-promise",on_resolve_promise)

#    print("Exiting")
#    await c.exit()

print( "PROCESS STARTED" )

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.run_until_complete( c.t1 )
loop.close()
