#!/bin/env python3.9

import asyncio
import ppk

import numpy as np
c = ppk.Client()
s = ppk.RemoteSlurm()
#s = ppk.LocalServer()

class Summatra:
    def __init__(self,rapi):
        self.rapi = rapi
        rapi.sum = self.sum

    async def sum( self,a,b ):
   	    return await self.rapi.exec_request( c.js("args => args.a + args.b",a=a,b=b) )

async def main():	
	print("starting system")
	s1 = await s.start()
	print("done, s1=",s1)
	print("starting workers")
	w1 = await s.start_workers( 2, 2, 4000 )
	print("done, w1=",w1)

	print("connecting")
	t1 = await c.connect( url=s.url )

	print("connected",t1)
	
	arr = np.array([2, 2, 3.0])
	arr2 = np.array([20, 0, 4.0])
	chk = arr + arr2
	print("chk: ",arr,"+",arr2,"=",chk)
	handle = await c.add_data( arr )
	handle2 = await c.add_data( arr2 )
	print("handle of data=",handle)

	async def summer(a=0,b=0,rapi=None,**kwargs):
		print("a=",a,file=sys.stderr)
		a = await rapi.get_payload( a )
		b = await rapi.get_payload( b )
		#print("adding a+b,.  a=",a,"b=",b)
		d = a + b
		d = await rapi.submit_payload( d )
		#d = await rapi.add_data( d )
		return d
		#return a+b
	
	print("subtmitting exec")
	h2 = await c.exec_request( c.python(summer,a=handle,b=handle2) )
	h3 = await c.exec_request( c.python(summer,a=h2,b=h2) )
	#h2 = await c.exec_request( c.python(summer,a=1,b=2) )

	print("waiting exec result",h2)
	dat = await c.get_data( h2 )
	print("result=",dat)
	print("result * 2 = ", await c.get_data( h3 ))
	#await asyncio.sleep( 5 )
	#print("cleanup")
	#s.cleanup()
	print("Exiting")
	await c.exit()
	await s.exit()

import os
import signal
#os.setpgrp()	
#os.killpg(0, signal.SIGTERM)

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.run_until_complete( c.t1 )
loop.close()

#asyncio.run( main() )